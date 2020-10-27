const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals } = require("./shared/utilities")

use(solidity)

describe("Latte", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let cafe
  let pool

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    cafe = fixtures.cafe
    pool = fixtures.pool
  })

  it("inits name", async () => {
    expect(await latte.name()).eq("Latte")
  })

  it("inits symbol", async () => {
    expect(await latte.symbol()).eq("LATTE")
  })

  it("inits decimals", async () => {
    expect(await latte.decimals()).eq(18)
  })

  it("inits website", async () => {
    expect(await latte.website()).eq("https://lattefi.com")
  })

  it("inits gov", async () => {
    expect(await latte.gov()).eq(wallet.address)
  })

  it("setGov fails if sender is not gov", async () => {
    await expect(latte.connect(user0).setGov(user1.address))
      .to.be.revertedWith("Latte: forbidden")
  })

  it("setGov", async () => {
    await latte.setGov(user0.address)
    expect(await latte.gov()).eq(user0.address)

    await latte.connect(user0).setGov(user1.address)
    expect(await latte.gov()).eq(user1.address)
  })

  it("setWebsite fails if sender is not gov", async () => {
    await expect(latte.connect(user0).setWebsite("lattefi"))
      .to.be.revertedWith("Latte: forbidden")
  })

  it("setWebsite", async () => {
    await latte.setGov(user0.address)
    await latte.connect(user0).setWebsite("lattefi")
    expect(await latte.website()).equal("lattefi")
  })

  it("setCafe", async () => {
    await expect(latte.connect(user0).setCafe(user1.address))
      .to.be.revertedWith("Latte: forbidden")
    await latte.setGov(user0.address)

    await expect(latte.connect(user0).setCafe(user1.address))
      .to.be.revertedWith("Latte: cafe already set")

    expect(await latte.cafe()).eq(cafe.address)
  })

  it("setPool", async () => {
    await expect(latte.connect(user0).setPool(user1.address))
      .to.be.revertedWith("Latte: forbidden")
    await latte.setGov(user0.address)

    await expect(latte.connect(user0).setPool(user1.address))
      .to.be.revertedWith("Latte: pool already set")

    expect(await latte.pool()).eq(pool.address)
  })

  it("mint fails unless sender is cafe", async () => {
    const latteMock = await deployContract("Latte", ["10"])
    await latteMock.setCafe(user1.address)
    expect(await latteMock.balanceOf(user1.address)).eq("0")

    await expect(latteMock.connect(user0).mint(user1.address, "1"))
      .to.be.revertedWith("Latte: forbidden")
    expect(await latteMock.balanceOf(user1.address)).eq("0")

    await latteMock.connect(user1).mint(user1.address, "7")
    expect(await latteMock.balanceOf(user1.address)).eq("7")
    expect(await latteMock.totalSupply()).eq("17")
  })

  it("burn fails unless sender is pool", async () => {
    const latteMock = await deployContract("Latte", ["10"])
    await latteMock.setCafe(user1.address)
    await latteMock.connect(user1).mint(user0.address, "7")
    expect(await latteMock.balanceOf(user0.address)).eq("7")
    expect(await latteMock.totalSupply()).eq("17")

    await latteMock.setPool(user1.address)

    await expect(latteMock.connect(user0).burn(user0.address, "2"))
      .to.be.revertedWith("Latte: forbidden")
    expect(await latteMock.balanceOf(user0.address)).eq("7")

    await latteMock.connect(user1).burn(user0.address, "2")
    expect(await latteMock.balanceOf(user0.address)).eq("5")
    expect(await latteMock.totalSupply()).eq("15")
  })

  it("transfer", async () => {
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000, 18))
    await latte.transfer(user0.address, expandDecimals(200, 18)) // burn 6
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(200, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 6, 18))

    await latte.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 3
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(200 - 100 - 3, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 6 - 3, 18))
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 6 + 3, 18))
  })

  it("toast", async () => {
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000, 18))
    await latte.transfer(user0.address, expandDecimals(100, 18)) // burn 3
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(100, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 3, 18))
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 3, 18))

    await latte.connect(user0).toast(expandDecimals(5, 18)) // burn 5
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(95, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 3 - 5, 18))

    // token reserve of cafe should not increase
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 3, 18))
  })

  it("exempts", async () => {
    await latte.transfer(user0.address, expandDecimals(300, 18)) // burn 9
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(300, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 9, 18))

    await latte.addExemption(user0.address)

    await latte.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 0
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(300 - 100, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 9, 18))

    await latte.removeExemption(user0.address)

    await latte.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 3
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(300 - 100 - 100 - 3, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 9 - 3, 18))
  })
})
