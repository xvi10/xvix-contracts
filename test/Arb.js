const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals, bigNumberify } = require("./shared/utilities")
const { addLiquidityETH, buyTokens } = require("./shared/uniswap")
const { getMinterArbComponents } = require("./shared/arb")

use(solidity)

describe("Arb", function () {
  const provider = waffle.provider
  const [wallet, user0] = provider.getWallets()
  const distributor = user0
  let xvix
  let minter
  let floor
  let weth
  let router
  let pairs
  let lendingPool
  let arb

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    minter = fixtures.minter
    floor = fixtures.floor
    weth = fixtures.weth
    router = fixtures.router
    pairs = fixtures.pairs

    lendingPool = await deployContract("LendingPool", [])
    const lendingPoolAddressesProvider = await deployContract("LendingPoolAddressesProvider", [lendingPool.address])

    arb = await deployContract("Arb", [
      xvix.address,
      weth.address,
      minter.address,
      floor.address,
      router.address,
      wallet.address,
      lendingPoolAddressesProvider.address
    ])
  })

  it("rebalanceMinter", async () => {
    const receiver = { address: "0xfaf16340b5995774136c66baba89c673cc636cbf" }
    await arb.setReceiver(receiver.address)

    const pair = pairs.xvix.weth

    // at launch, minter is enabled with the full sum of ETH received
    await minter.connect(user0).enableMint(expandDecimals(160, 18))

    // the XVIX / ETH pair gets 1/4 of the ETH received
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(500, 18), ethAmount: expandDecimals(40, 18) })

    // the floor receives 1/2 of the ETH received
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(80, 18) })

    const xi = await minter.ethReserve()
    const yi = await minter.tokenReserve()
    const xn = await weth.balanceOf(pair.address)
    const yn = await xvix.balanceOf(pair.address)

    expect(xi).eq(expandDecimals(160, 18))
    expect(yi).eq("1002150000000000000000") // 1002.15
    expect(xn).eq(expandDecimals(40, 18))
    expect(yn).eq("497500000000000000000") // 497.5

    // there should not be an arbitrage opportunity at launch
    const { dy: dy0, dxi: dxi0, dxn: dxn0 } = await getMinterArbComponents({ minter, weth, xvix, pair })
    expect(dy0).eq(0)
    expect(dxi0).eq(0)
    expect(dxn0).eq(0)

    await buyTokens({ router, wallet, receiver: wallet, weth, token: xvix,
      ethAmount: expandDecimals(100, 18) })

    const { dy: dy1, dxi: dxi1, dxn: dxn1 } = await getMinterArbComponents({ minter, weth, xvix, pair })
    expect(dy1).eq("156201756084063455483") // ~156.2 XVIX
    expect(dxi1).eq("29490288143586167146") // ~29.5 ETH
    expect(dxn1).eq("73223693837070309190") // ~73.2 ETH

    await wallet.sendTransaction({ to: lendingPool.address, value: bigNumberify("29500000000000000000") }) // transfer 29.5 ETH

    expect(await provider.getBalance(lendingPool.address)).eq("29500000000000000000")
    expect(await provider.getBalance(receiver.address)).eq("0")
    await arb.rebalanceMinter(dxi1)
    expect(await provider.getBalance(lendingPool.address)).eq("29588470864430758501") // 29.5 + fees (0.3% of 29.49...)
    expect(await provider.getBalance(receiver.address)).eq("43364882956686346300") // ~43.3, receiver earns the profits
    expect(await provider.getBalance(arb.address)).eq("0")
    expect(await xvix.balanceOf(arb.address)).eq("0")
  })
})
