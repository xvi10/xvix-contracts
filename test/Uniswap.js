const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock } = require("./shared/utilities")
const { getRebaseTime } = require("./shared/xvix")
const { addLiquidityETH, buyTokens, sellTokensWithFee, removeLiquidityETHWithFee } = require("./shared/uniswap")

use(solidity)

describe("Uniswap", function() {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C"}
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let xvix
  let weth
  let router
  let pairs

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    weth = fixtures.weth
    router = fixtures.router
    pairs = fixtures.pairs
  })

  it("addLiquidityETH", async () => {
    const pair = pairs.xvix.weth
    expect(await xvix.balanceOf(pair.address)).eq(0)
    expect(await provider.getBalance(pair.address)).eq(0)
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvix.balanceOf(pair.address)).eq(expandDecimals(99, 18))
    expect(await weth.balanceOf(pair.address)).eq(expandDecimals(40, 18))
  })

  it("buyTokens", async () => {
    const receiver = { address: "0xe242271f229e4a7e3f3d555d5b0f86a412f24123" }
    const pair = pairs.xvix.weth
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvix.balanceOf(receiver.address)).eq(0)
    await buyTokens({ router, wallet, receiver, weth, token: xvix,
      ethAmount: expandDecimals(1, 18) })

    expect(await xvix.balanceOf(receiver.address)).eq("2383490743225114033")
  })

  it("sellTokensWithFee", async () => {
    const receiver = { address: "0xdd2535db6540b0e48366e2112aac1703566bd2d3" }
    const pair = pairs.xvix.weth
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await provider.getBalance(receiver.address)).eq(0)
    await sellTokensWithFee({ router, wallet, receiver, weth, token: xvix,
      tokenAmount: expandDecimals(1, 18) })

    expect(await provider.getBalance(receiver.address)).eq("394863213758824519")
  })

  it("removeLiquidityETHWithFee", async () => {
    const receiver = { address: "0x792869ffa0781b6dd4f2ba85e6993b10cd69cb2c" }
    const pair = pairs.xvix.weth
    expect(await xvix.balanceOf(pair.address)).eq(0)
    expect(await provider.getBalance(pair.address)).eq(0)
    await addLiquidityETH({ router, wallet, token: xvix,
      tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })

    expect(await xvix.balanceOf(pair.address)).eq(expandDecimals(99, 18))
    expect(await weth.balanceOf(pair.address)).eq(expandDecimals(40, 18))

    const liquidity = await pair.balanceOf(wallet.address)
    await pair.approve(router.address, liquidity)
    await removeLiquidityETHWithFee({ router, wallet, receiver, token: xvix, liquidity })

    expect(await xvix.balanceOf(pair.address)).eq("1574")
    expect(await provider.getBalance(pair.address)).eq(0)

    expect(await xvix.balanceOf(receiver.address)).eq("97029899999999998458")
    expect(await provider.getBalance(receiver.address)).eq("39999999999999999364")
  })
})
