const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals } = require("./shared/utilities")

use(solidity)

describe("Distributor", function() {
  const provider = waffle.provider
  const [wallet, user0] = provider.getWallets()
  let latte
  let distributor
  let pool
  let lp
  let fund

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    distributor = fixtures.distributor
    pool = fixtures.pool
    lp = fixtures.lp
    fund = fixtures.fund
  })

  it("mint fails unless distribution is active", async () => {
    await distributor.stop()
    await expect(distributor.mint(user0.address))
      .to.be.revertedWith("Distributor: not active")
  })

  it("mint fails if value is zero", async () => {
    await expect(distributor.mint(user0.address))
      .to.be.revertedWith("Distributor: insufficient value")
  })

  it("mint fails if mint amount is zero", async () => {
    const distributorMock = await deployContract("Distributor", [latte.address, pool.address, user0.address, user0.address, 1, 5, 10])
    await expect(distributorMock.mint(user0.address, { value: "1" }))
      .to.be.revertedWith("Distributor: mint amount is zero")
  })

  it("mint fails if cap is reached", async () => {
    await distributor.mint(user0.address, { value: "10" })
    await expect(distributor.mint(user0.address, { value: expandDecimals(15, 18) }))
      .to.be.revertedWith("Distributor: cap reached")
  })

  it("mints", async () => {
    expect(await provider.getBalance(distributor.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")
    expect(await latte.balanceOf(lp)).eq("0")

    const lpBalance = await provider.getBalance(lp)
    const fundBalance = await provider.getBalance(fund)
    const poolBalance = await provider.getBalance(pool.address)

    await distributor.mint(user0.address, { value: expandDecimals(10, 18) })

    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(25, 18))
    expect(await latte.balanceOf(lp)).eq(expandDecimals(5, 18)) // 20% of 25
    expect((await provider.getBalance(lp)).sub(lpBalance)).eq(expandDecimals(2, 18)) // 20% of 10
    expect((await provider.getBalance(fund)).sub(fundBalance)).eq(expandDecimals(2, 18)) // 20% of 10
    expect((await provider.getBalance(pool.address)).sub(poolBalance)).eq(expandDecimals(6, 18)) // 60% of 10

    expect(await provider.getBalance(distributor.address)).eq("0")
  })
})
