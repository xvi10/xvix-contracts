const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock } = require("./shared/utilities")
const { addLiquidityETH, removeLiquidityETH, buyTokens, sellTokens } = require("./shared/uniswap")

use(solidity)

describe("Market", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let xvix
  let router
  let market
  let weth
  let pair

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    xvix = fixtures.xvix
    router = fixtures.router
    market = fixtures.market
    weth = fixtures.weth
    pair = fixtures.pair
  })

  it("addLiquidityETH burns for Uniswap router", async () => {
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    const tokenAmount = expandDecimals(200, 18)
    const ethAmount = expandDecimals(50, 18)
    await addLiquidityETH({ router, wallet, token: xvix, tokenAmount, ethAmount }) // burn 2
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000 - 200 - 2, 18))

    await addLiquidityETH({ router: market, wallet, token: xvix, tokenAmount, ethAmount })
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000 - 200 - 200 - 2, 18))
  })

  it("buyTokens", async () => {
    const tokenAmount = expandDecimals(1000, 18)
    const ethAmount = expandDecimals(400, 18)
    await addLiquidityETH({ router: market, wallet, token: xvix, tokenAmount, ethAmount })
    expect(await xvix.balanceOf(user0.address)).eq("0")
    await buyTokens({ router, wallet: user0, weth, token: xvix, ethAmount: expandDecimals(1, 18) })
    expect(await xvix.balanceOf(user0.address)).eq("2486302890046558951")
  })

  it("sellTokens", async () => {
    const tokenAmount = expandDecimals(500, 18)
    const ethAmount = expandDecimals(200, 18)
    await addLiquidityETH({ router: market, wallet, token: xvix, tokenAmount, ethAmount })
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(500, 18))
    await sellTokens({ router, wallet, weth, token: xvix, tokenAmount: expandDecimals(100, 18) }) // burn 1
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(500 - 100 - 1, 18))
  })

  it("removeLiquidityETH", async () => {
    const tokenAmount = expandDecimals(1000, 18)
    const ethAmount = expandDecimals(400, 18)
    await addLiquidityETH({ router: market, wallet, token: xvix, tokenAmount, ethAmount })
    const liquidity = await pair.balanceOf(wallet.address)
    await pair.approve(market.address, liquidity)
    await removeLiquidityETH({ router: market, wallet, token: xvix, liquidity })
  })

  it("removeLiquidityETH works with burns", async () => {
    await xvix.removeExemption(pair.address)

    const tokenAmount = expandDecimals(1000, 18)
    const ethAmount = expandDecimals(400, 18)
    await addLiquidityETH({ router: market, wallet, token: xvix, tokenAmount, ethAmount })
    const liquidity = await pair.balanceOf(wallet.address)
    await pair.approve(market.address, liquidity)

    expect(await xvix.getBurnAllowance(pair.address), "0")

    await increaseTime(provider, 12 * 24 * 60 * 60)
    await mineBlock(provider)

    expect(await xvix.getBurnAllowance(pair.address), "50000000000000000000")

    await xvix.connect(user0).roast(pair.address, user1.address)
    expect(await xvix.balanceOf(pair.address), "940000000000000000000")
    expect(await xvix.balanceOf(user0.address), "0")
    expect(await xvix.balanceOf(user1.address), "10000000000000000000")
    expect(await xvix.getBurnAllowance(pair.address), "0")

    await xvix.addExemption(pair.address)

    expect(await xvix.balanceOf(wallet.address), "0")
    await removeLiquidityETH({ router: market, wallet, token: xvix, liquidity })
    expect(await xvix.balanceOf(wallet.address), "939999999999999998513")
  })
})
