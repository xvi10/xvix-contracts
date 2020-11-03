const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals } = require("./shared/utilities")

use(solidity)

describe("Distributor", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
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

  it("inits", async () => {
    expect(await distributor.latte()).eq(latte.address)
    expect(await distributor.pool()).eq(pool.address)
    expect(await distributor.lp()).eq(lp)
    expect(await distributor.fund()).eq(fund)
    expect(await distributor.multiplier()).eq(5)
    expect(await distributor.divisor()).eq(2)
    expect(await distributor.ethMaxCap()).eq(expandDecimals(20, 18))
    expect(await distributor.ethSoftCap()).eq(expandDecimals(15, 18))
    expect(await distributor.gov()).eq(wallet.address)
  })

  it("setSoftCap", async () => {
    await expect(distributor.connect(user0).setSoftCap(100))
      .to.be.revertedWith("Distributor: forbidden")
    await expect(distributor.setSoftCap(expandDecimals(21, 18)))
      .to.be.revertedWith("Distributor: cannot exceed max cap")

    expect(await distributor.ethSoftCap()).eq(expandDecimals(15, 18))
    await distributor.setSoftCap(expandDecimals(20, 18))
    expect(await distributor.ethSoftCap()).eq(expandDecimals(20, 18))
  })

  it("setFund", async () => {
    await expect(distributor.connect(user0).setFund(user1.address))
      .to.be.revertedWith("Distributor: forbidden")

    expect(await distributor.fund()).eq(fund)
    await distributor.setFund(user1.address)
    expect(await distributor.fund()).eq(user1.address)
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
    const distributorMock = await deployContract("Distributor", [latte.address, pool.address, user0.address, user0.address, 1, 5, 20, 10, 10])
    await expect(distributorMock.mint(user0.address, { value: "1" }))
      .to.be.revertedWith("Distributor: mint amount is zero")
  })

  it("mint fails if cap is reached", async () => {
    await distributor.mint(user0.address, { value: "10" })
    await expect(distributor.mint(user0.address, { value: expandDecimals(15, 18) }))
      .to.be.revertedWith("Distributor: cap reached")
  })

  it("mint fails if individual cap is exceeded", async () => {
    const distributorMock = await deployContract("Distributor", [latte.address, pool.address, user0.address, user0.address, 1, 5, 20, 10, 1])
    await expect(distributorMock.mint(user0.address, { value: "2" }))
      .to.be.revertedWith("Distributor: individual cap exceeded")
  })

  it("mints", async () => {
    expect(await provider.getBalance(distributor.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")
    expect(await latte.balanceOf(lp)).eq("0")

    const lpBalance = await provider.getBalance(lp)
    const fundBalance = await provider.getBalance(fund)
    const poolBalance = await provider.getBalance(pool.address)

    expect(await distributor.getRemainingAllocation(user0.address)).eq(expandDecimals(15, 18))
    await distributor.mint(user0.address, { value: expandDecimals(10, 18) })
    expect(await distributor.getRemainingAllocation(user0.address)).eq(expandDecimals(5, 18))

    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(25, 18))
    expect(await latte.balanceOf(lp)).eq(expandDecimals(5, 18)) // 20% of 25
    expect((await provider.getBalance(lp)).sub(lpBalance)).eq(expandDecimals(2, 18)) // 20% of 10
    expect((await provider.getBalance(fund)).sub(fundBalance)).eq(expandDecimals(2, 18)) // 20% of 10
    expect((await provider.getBalance(pool.address)).sub(poolBalance)).eq(expandDecimals(6, 18)) // 60% of 10

    expect(await provider.getBalance(distributor.address)).eq("0")
  })

  it("mints to fund", async () => {
    expect(await provider.getBalance(distributor.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")
    expect(await latte.balanceOf(lp)).eq("0")

    await distributor.setFund(pool.address)

    const lpBalance = await provider.getBalance(lp)
    const fundBalance = await provider.getBalance(fund)
    const poolBalance = await provider.getBalance(pool.address)

    await distributor.mint(user0.address, { value: expandDecimals(10, 18) })

    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(25, 18))
    expect(await latte.balanceOf(lp)).eq(expandDecimals(5, 18)) // 20% of 25
    expect((await provider.getBalance(lp)).sub(lpBalance)).eq(expandDecimals(2, 18)) // 20% of 10
    expect((await provider.getBalance(fund)).sub(fundBalance)).eq(0) // 20% of 10
    expect((await provider.getBalance(pool.address)).sub(poolBalance)).eq(expandDecimals(8, 18)) // 80% of 10

    expect(await provider.getBalance(distributor.address)).eq("0")
  })
})
