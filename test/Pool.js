const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime } = require("./shared/utilities")
const { addLiquidityETH, sellTokens, buyTokens } = require("./shared/uniswap")
const { expectBetween } = require("./shared/waffle")

use(solidity)

describe("Pool", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let router
  let shopper
  let pricer
  let market
  let pool

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    shopper = fixtures.shopper
    pricer = fixtures.pricer
    market = fixtures.market
    pool = fixtures.pool
  })

  it("inits latestSlot", async () => {
    expect(await pool.latestSlot()).gt(0)
  })

  it("inits market", async () => {
    expect(await pool.market()).eq(market.address)
  })

  it("setMarket fails if sender is not gov", async () => {
    await expect(pool.connect(user0).setMarket("0x2f063ac4a33b76273c6e308a6c57a8f7876cd5e6"))
      .to.be.revertedWith("Pool: forbidden")
  })

  it("setMarket fails if market was already initialised", async () => {
    await expect(pool.setMarket("0x2f063ac4a33b76273c6e308a6c57a8f7876cd5e6"))
      .to.be.revertedWith("Pool: market already set")
  })

  it("updates capital", async () => {
    const amount = expandDecimals(2, 18)
    expect(await pool.capital()).eq("0")
    await pool.fund({ value: amount })
    expect(await pool.capital()).eq(amount)
  })

  it("mint fails if sender is not market", async () => {
    await expect(pool.mint(user0.address, "1"))
      .to.be.revertedWith("Pool: forbidden")
  })

  it("mints", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })

    const sellAmount = expandDecimals(1, 18)
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })

    const latestSlot = await pool.latestSlot()

    // user0 buys
    expect(await pool.shares(latestSlot, user0.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")

    const buyAmount0 = expandDecimals(1, 18)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })
    expect(await pool.latestSlot()).eq(latestSlot)

    const expectedRewards0 = await latte.balanceOf(user0.address)
    // 2.516, slightly less than the shopper's price of ~2.52 because of slippage
    expectBetween(expectedRewards0, "2516000000000000000", "2517000000000000000")
    expect(await pool.shares(latestSlot, user0.address)).eq(expectedRewards0)
    expect(await pool.totalShares(latestSlot)).eq(expectedRewards0)

    // user1 buys
    expect(await pool.shares(latestSlot, user1.address)).eq("0")
    expect(await latte.balanceOf(user1.address)).eq("0")

    const buyAmount1 = expandDecimals(2, 18)
    await buyTokens({ router: market, wallet: user1, weth, token: latte, amount: buyAmount1 })
    expect(await pool.latestSlot()).eq(latestSlot)

    const expectedRewards1 = await latte.balanceOf(user1.address)
    expectBetween(expectedRewards1, "4994000000000000000", "4995000000000000000")
    expect(await pool.shares(latestSlot, user1.address)).eq(expectedRewards1)
    expect(await pool.totalShares(latestSlot)).eq(expectedRewards0.add(expectedRewards1))
  })
})
