const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime } = require("./shared/utilities")
const { addLiquidityETH, sellTokens } = require("./shared/uniswap")
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
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })
  })

})
