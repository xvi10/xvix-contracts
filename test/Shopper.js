const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime } = require("./shared/utilities")
const { addLiquidityETH, buyTokens } = require("./shared/uniswap")
const { expectBetween } = require("./shared/waffle")

use(solidity)

describe("Shopper", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let router
  let shopper
  let pricer
  let pool

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    shopper = fixtures.shopper
    pricer = fixtures.pricer
    pool = fixtures.pool
  })

  it("inits cashier", async () => {
    expect(await shopper.cashier()).eq(wallet.address)
  })

  it("inits gov", async () => {
    expect(await shopper.gov()).eq(wallet.address)
  })

  it("sets cashier", async () => {
    await shopper.setCashier(user0.address)
    expect(await shopper.cashier()).eq(user0.address)
  })

  it("sets gov", async () => {
    await shopper.setGov(user0.address)
    expect(await shopper.gov()).eq(user0.address)
  })

  it("sets fee", async () => {
    await shopper.setFee("200")
    expect(await shopper.feeBasisPoints()).eq("200")
  })

  it("setCashier fails unless sender is gov", async () => {
    await shopper.setGov(user0.address)
    await expect(shopper.setCashier(user1.address))
      .to.be.revertedWith("Shopper: forbidden")

    expect(await shopper.cashier()).eq(wallet.address)

    await shopper.connect(user0).setCashier(user1.address)
    expect(await shopper.cashier()).eq(user1.address)
  })

  it("setGov fails unless sender is gov", async () => {
    await shopper.setGov(user0.address)
    await expect(shopper.setGov(user1.address))
      .to.be.revertedWith("Shopper: forbidden")

    expect(await shopper.gov()).eq(user0.address)

    await shopper.connect(user0).setGov(user1.address)
    expect(await shopper.gov()).eq(user1.address)
  })

  it("setFee fails unless sender is gov", async () => {
    await shopper.setGov(user0.address)
    await expect(shopper.setFee("300"))
      .to.be.revertedWith("Shopper: forbidden")

    expect(await shopper.feeBasisPoints()).eq("100")

    await shopper.connect(user0).setFee("300")
    expect(await shopper.feeBasisPoints()).eq("300")
  })

  it("setFee fails if fee exceeds allowed limit", async () => {
    await shopper.setFee("500")
    await expect(shopper.setFee("501"))
      .to.be.revertedWith("Shopper: fee exceeds allowed limit")
  })
})
