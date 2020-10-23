const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime, gasUsed } = require("./shared/utilities")
const { addLiquidityETH, buyTokens } = require("./shared/uniswap")
const { expectBetween } = require("./shared/waffle")
const { increasePrice } = require("./shared/pricer")

use(solidity)

describe("Cafe", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let router
  let cafe
  let pricer
  let shopper
  let pool

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    cafe = fixtures.cafe
    pricer = fixtures.pricer
    shopper = fixtures.shopper
    pool = fixtures.pool
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

  it("mint fails if value is zero", async () => {
    await expect(cafe.mint(user0.address, { value: "0" }))
      .to.be.revertedWith("Cafe: insufficient value in")
  })

  it("mint fails unless price is increasing", async () => {
    await expect(cafe.mint(user0.address, { value: "100" }))
      .to.be.revertedWith("Cafe: latte fully sold")
  })

  it("mints", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const buyAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await increasePrice({ provider, router, wallet, latte, weth, buyAmount })

    const cashier = "0xa63c44249f0f7dd3b0571f7d96427a677a497f68"
    await cafe.setCashier(cashier)

    expect(await latte.totalSupply()).eq(expandDecimals(10000, 18))

    // 50 tokens allowed to be minted, 0.5% of the total supply of 10000
    expect(await cafe.getMaxMintableAmount()).eq("50000000000000000000")
    expect(await latte.balanceOf(user0.address)).eq(0)
    const tx0 = await cafe.connect(user0).mint(user1.address, { value: expandDecimals(1, 18) })
    console.log("tx0 gasUsed", (await gasUsed(provider, tx0)).toString())
    const minted = await latte.balanceOf(user1.address)
    // 2.45, which is close to 1000 / 400 = 2.5
    expectBetween(minted, "2450000000000000000", "2451000000000000000")
    expect(await latte.totalSupply()).eq(expandDecimals(10000, 18).add(minted))

    const mintable = expandDecimals(50, 18).sub(minted)
    expect(await cafe.getMaxMintableAmount()).eq(mintable)

    const shopperBalance = await provider.getBalance(shopper.address)
    const poolBalance = await provider.getBalance(pool.address)
    const cashierBalance = await provider.getBalance(cashier)
    expect(shopperBalance).eq("495000000000000000")
    expect(poolBalance).eq("495000000000000000")
    expect(cashierBalance).eq("10000000000000000")

    expect(shopperBalance.add(poolBalance).add(cashierBalance)).eq(expandDecimals(1, 18))

    await expect(cafe.connect(user0).mint(user0.address, { value: expandDecimals(20, 18) }))
      .to.be.revertedWith("Cafe: amount to sell exceeds allowed limit")
  })
})
