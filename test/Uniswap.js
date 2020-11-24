const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract, contractAt } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock, reportGasUsed } = require("./shared/utilities")
const { getRebaseTime } = require("./shared/xvix")
const { addLiquidityETH, buyTokens, sellTokensWithFee,
  removeLiquidityETHWithFee } = require("./shared/uniswap")

use(solidity)

describe("Uniswap", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet] = provider.getWallets()
  let xvix
  let weth
  let router
  let factory
  let pairs

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    weth = fixtures.weth
    router = fixtures.router
    factory = fixtures.factory
    pairs = fixtures.pairs
  })

  it("addLiquidityETH", async () => {
    const pair = pairs.xvix.weth
    expect(await xvix.balanceOf(pair.address)).eq(0)
    expect(await provider.getBalance(pair.address)).eq(0)
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvix.balanceOf(pair.address)).eq("99500000000000000000")
    expect(await weth.balanceOf(pair.address)).eq(expandDecimals(40, 18))
  })

  it("addLiquidityETH with existing WETH", async () => {
    const pair = pairs.xvix.weth
    await weth.deposit({ value: expandDecimals(50, 18) })
    await weth.transfer(pair.address, expandDecimals(50, 18))

    expect(await xvix.balanceOf(pair.address)).eq(0)
    expect(await weth.balanceOf(pair.address)).eq(expandDecimals(50, 18))
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvix.balanceOf(pair.address)).eq("99500000000000000000")
    expect(await weth.balanceOf(pair.address)).eq(expandDecimals(90, 18))
  })

  it("buyTokens", async () => {
    const receiver = { address: "0xe242271f229e4a7e3f3d555d5b0f86a412f24123" }
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvix.balanceOf(receiver.address)).eq(0)
    const tx = await buyTokens({ router, wallet, receiver, weth, token: xvix,
      ethAmount: expandDecimals(1, 18) })
    await reportGasUsed(provider, tx, "buyTokens gas used")

    expect(await xvix.balanceOf(receiver.address)).eq("2407627204429592409")
  })

  it("buyTokens after rebase", async () => {
    const xvixMock = await deployContract("XVIX", [expandDecimals(1000, 18), expandDecimals(2000, 18), "100"])
    await factory.createPair(xvixMock.address, weth.address)
    const pairAddress = await factory.getPair(xvixMock.address, weth.address)
    const pair = await contractAt("UniswapV2Pair", pairAddress)

    const receiver = { address: "0xe242271f229e4a7e3f3d555d5b0f86a412f24123" }
    await addLiquidityETH({ router, wallet, token: xvixMock,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvixMock.balanceOf(pair.address)).eq("99500000000000000000")

    await increaseTime(provider, await getRebaseTime(provider, xvixMock, 3))
    await mineBlock(provider)
    await xvixMock.rebase()
    await pair.sync()

    expect(await xvixMock.balanceOf(pair.address)).eq("99440323872837432799")

    expect(await xvixMock.balanceOf(receiver.address)).eq(0)
    await buyTokens({ router, wallet, receiver, weth, token: xvixMock,
      ethAmount: expandDecimals(1, 18) })

    expect(await xvixMock.balanceOf(receiver.address)).eq("2406183205764149227")
  })

  it("sellTokensWithFee", async () => {
    const receiver = { address: "0xdd2535db6540b0e48366e2112aac1703566bd2d3" }
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await provider.getBalance(receiver.address)).eq(0)
    await sellTokensWithFee({ router, wallet, receiver, weth, token: xvix,
      tokenAmount: expandDecimals(1, 18) })

    expect(await provider.getBalance(receiver.address)).eq("394941406662410878")
  })

  it("removeLiquidityETHWithFee", async () => {
    const receiver = { address: "0x792869ffa0781b6dd4f2ba85e6993b10cd69cb2c" }
    const pair = pairs.xvix.weth
    expect(await xvix.balanceOf(pair.address)).eq(0)
    expect(await provider.getBalance(pair.address)).eq(0)
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvix.balanceOf(pair.address)).eq("99500000000000000000")
    expect(await weth.balanceOf(pair.address)).eq(expandDecimals(40, 18))

    const liquidity = await pair.balanceOf(wallet.address)
    await pair.approve(router.address, liquidity)
    await removeLiquidityETHWithFee({ router, wallet, receiver, token: xvix, liquidity })

    expect(await xvix.balanceOf(pair.address)).eq("1578")
    expect(await provider.getBalance(pair.address)).eq(0)

    expect(await xvix.balanceOf(receiver.address)).eq("98507487499999998438")
    expect(await provider.getBalance(receiver.address)).eq("39999999999999999365")
  })
})
