const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime, bigNumberify } = require("./shared/utilities")
const { addLiquidityETH, sellTokens, buyTokens } = require("./shared/uniswap")
const { expectBetween } = require("./shared/waffle")
const { increasePrice, decreasePrice } = require("./shared/pricer")

use(solidity)

describe("Market", function() {
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

  it("swapExactETHForTokens fails if the token to buy is not latte", async () => {
    await expect(market.swapExactETHForTokens(
      0,
      [weth.address, latte.address, "0x113350a69fb9d25e411eaaabfecfca043bae13a5"],
      wallet.address,
      ethers.constants.MaxUint256,
      { value: expandDecimals(1, 18) }
    )).to.be.revertedWith("Market: path does not end with latte")
  })

  it("swapETHForExactTokens fails if the token to buy is not latte", async () => {
    await expect(market.swapETHForExactTokens(
      10,
      [weth.address, latte.address, "0x113350a69fb9d25e411eaaabfecfca043bae13a5"],
      wallet.address,
      ethers.constants.MaxUint256,
      { value: expandDecimals(1, 18) }
    )).to.be.revertedWith("Market: path does not end with latte")
  })
})
