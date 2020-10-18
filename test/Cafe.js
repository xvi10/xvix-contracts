const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { increaseTime } = require("./shared/utilities")

use(solidity)

describe("Cafe", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let router
  let cafe

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    cafe = fixtures.cafe
  })

  it("inits cashier", async () => {
    expect(await cafe.cashier()).eq(wallet.address)
  })

  it("inits gov", async () => {
    expect(await cafe.gov()).eq(wallet.address)
  })

  it("sets cashier", async () => {
    await cafe.setCashier(user0.address)
    expect(await cafe.cashier()).eq(user0.address)
  })

  it("sets gov", async () => {
    await cafe.setGov(user0.address)
    expect(await cafe.gov()).eq(user0.address)
  })

  it("sets fee", async () => {
    await cafe.setFee("200")
    expect(await cafe.feeBasisPoints()).eq("200")
  })

  it("setCashier fails unless sender is gov", async () => {
    await cafe.setGov(user0.address)
    await expect(cafe.setCashier(user1.address))
      .to.be.revertedWith("Cafe: forbidden")

    expect(await cafe.cashier()).eq(wallet.address)

    await cafe.connect(user0).setCashier(user1.address)
    expect(await cafe.cashier()).eq(user1.address)
  })

  it("setGov fails unless sender is gov", async () => {
    await cafe.setGov(user0.address)
    await expect(cafe.setGov(user1.address))
      .to.be.revertedWith("Cafe: forbidden")

    expect(await cafe.gov()).eq(user0.address)

    await cafe.connect(user0).setGov(user1.address)
    expect(await cafe.gov()).eq(user1.address)
  })

  it("setFee fails unless sender is gov", async () => {
    await cafe.setGov(user0.address)
    await expect(cafe.setFee("300"))
      .to.be.revertedWith("Cafe: forbidden")

    expect(await cafe.feeBasisPoints()).eq("100")

    await cafe.connect(user0).setFee("300")
    expect(await cafe.feeBasisPoints()).eq("300")
  })

  it("setFee fails if fee exceeds allowed limit", async () => {
    await cafe.setFee("500")
    await expect(cafe.setFee("501"))
      .to.be.revertedWith("Cafe: fee exceeds allowed limit")
  })
})
