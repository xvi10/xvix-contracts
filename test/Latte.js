const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock } = require("./shared/utilities")
const { getLatestSlot, expectLedger } = require("./shared/latte")

use(solidity)

describe("Latte", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let cafe
  let pool
  let distributor

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    cafe = fixtures.cafe
    pool = fixtures.pool
    distributor = fixtures.distributor
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

  it("inits max supply", async () => {
    expect(await latte.maxSupply()).eq(expandDecimals(2000, 18))
  })

  it("inits ledger", async () => {
    const slot = await getLatestSlot(provider)
    await expectLedger(latte, wallet.address, 0, 0, slot, expandDecimals(1000, 18))
  })

  it("setGov", async () => {
    await expect(latte.connect(user0).setGov(user1.address))
      .to.be.revertedWith("Latte: forbidden")
    await latte.setGov(user0.address)

    expect(await latte.gov()).eq(user0.address)

    await latte.connect(user0).setGov(user1.address)
    expect(await latte.gov()).eq(user1.address)
  })

  it("setWebsite", async () => {
    await expect(latte.connect(user0).setWebsite("lattefi"))
      .to.be.revertedWith("Latte: forbidden")
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

  it("setDistributor", async () => {
    await expect(latte.connect(user0).setDistributor(user1.address))
      .to.be.revertedWith("Latte: forbidden")
    await latte.setGov(user0.address)

    await expect(latte.connect(user0).setDistributor(user1.address))
      .to.be.revertedWith("Latte: distributor already set")

    expect(await latte.distributor()).eq(distributor.address)
  })

  it("addExemption", async () => {
    await expect(latte.connect(user0).addExemption(user1.address))
      .to.be.revertedWith("Latte: forbidden")
    await latte.setGov(user0.address)

    expect(await latte.exemptions(user1.address)).eq(false)
    await latte.connect(user0).addExemption(user1.address)
    expect(await latte.exemptions(user1.address)).eq(true)
  })

  it("removeExemption", async () => {
    await expect(latte.connect(user0).removeExemption(user1.address))
      .to.be.revertedWith("Latte: forbidden")
    await latte.setGov(user0.address)

    expect(await latte.exemptions(user1.address)).eq(false)
    await latte.connect(user0).addExemption(user1.address)
    expect(await latte.exemptions(user1.address)).eq(true)

    await latte.connect(user0).removeExemption(user1.address)
    expect(await latte.exemptions(user1.address)).eq(false)
  })

  it("mint can be called by distributor", async () => {
    const latteMock = await deployContract("Latte", ["10", "20"])
    await latteMock.setDistributor(user1.address)
    expect(await latteMock.balanceOf(user1.address)).eq("0")

    await expect(latteMock.connect(user0).mint(user1.address, "1"))
      .to.be.revertedWith("Latte: forbidden")
    expect(await latteMock.balanceOf(user1.address)).eq("0")

    await latteMock.connect(user1).mint(user1.address, "7")
    expect(await latteMock.balanceOf(user1.address)).eq("7")
    expect(await latteMock.totalSupply()).eq("17")
  })

  it("mint can be called by cafe", async () => {
    const latteMock = await deployContract("Latte", ["10", "20"])
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
    const latteMock = await deployContract("Latte", ["10", "20"])
    await latteMock.setCafe(user1.address)
    await latteMock.connect(user1).mint(user0.address, "7")
    expect(await latteMock.balanceOf(user0.address)).eq("7")
    expect(await latteMock.totalSupply()).eq("17")

    await latteMock.setPool(user1.address)

    await expect(latteMock.connect(user0).burn(user0.address, "2"))
      .to.be.revertedWith("Latte: forbidden")
    expect(await latteMock.balanceOf(user0.address)).eq("7")
  })

  it("transfer", async () => {
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000, 18))
    await latte.transfer(user0.address, expandDecimals(200, 18)) // burn 2
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(200, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 2, 18))

    await latte.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 1
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(200 - 100 - 1, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 2 - 1, 18))
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 2 + 1, 18))
  })

  it("updates ledger", async () => {
    await expectLedger(latte, user0.address, 0, 0, 0, 0)
    await expectLedger(latte, user1.address, 0, 0, 0, 0)

    expect(await cafe.tokenReserve()).eq(expandDecimals(1000, 18))
    await latte.transfer(user0.address, expandDecimals(200, 18)) // burn 2
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(200, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 2, 18))

    const slot = await getLatestSlot(provider)
    await expectLedger(latte, user0.address, 0, 0, slot, expandDecimals(200, 18))
    await expectLedger(latte, user1.address, 0, 0, 0, 0)

    await latte.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 1
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(200 - 100 - 1, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 2 - 1, 18))
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 2 + 1, 18))

    await expectLedger(latte, user0.address, 0, 0, slot, expandDecimals(99, 18))
    await expectLedger(latte, user1.address, 0, 0, slot, expandDecimals(100, 18))
    expect(await latte.getBurnAllowance(user0.address)).eq(0)
    expect(await latte.getBurnAllowance(user1.address)).eq(0)

    await increaseTime(provider, 21 * 24 * 60 * 60)
    await mineBlock(provider)

    expect(await latte.getBurnAllowance(user0.address)).eq("2970000000000000000") // 3% of 99
    expect(await latte.getBurnAllowance(user1.address)).eq("3000000000000000000") // 3% of 100

    await latte.connect(user1).toast("1000000000000000000")
    const allowance = await latte.getBurnAllowance(user1.address)
    expect(await latte.getBurnAllowance(user1.address)).eq("2000000000000000000")

    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(99, 18))
    expect(await latte.balanceOf(user1.address)).eq(expandDecimals(99, 18))
    await latte.connect(user0).roast(user1.address, user0.address)
    expect(await latte.getBurnAllowance(user1.address)).eq("0")
     // 2/3 of burnt amount is paid as fees to user0
    expect(await latte.balanceOf(user0.address)).eq("100333333333333333333")
    expect(await latte.balanceOf(user1.address)).eq("95666666666666666667")

    await increaseTime(provider, 12 * 24 * 60 * 60)
    await mineBlock(provider)

    expect(await latte.getBurnAllowance(user0.address)).eq("3009999999999999999") // 3% of 100.333...
    expect(await latte.getBurnAllowance(user1.address)).eq("2870000000000000000") // 3% of 95.666...
  })

  it("toast", async () => {
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000, 18))
    await latte.transfer(user0.address, expandDecimals(100, 18)) // burn 1
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(100, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 1, 18))
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 1, 18))

    await latte.connect(user0).toast(expandDecimals(7, 18)) // burn 7
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(93, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 1 - 7, 18))

    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 1 + 7, 18))
  })

  it("exempts", async () => {
    await latte.transfer(user0.address, expandDecimals(300, 18)) // burn 3
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(300, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 3, 18))

    await increaseTime(provider, 12 * 24 * 60 * 60)
    await mineBlock(provider)

    await latte.addExemption(user0.address)

    expect(await latte.getBurnAllowance(user0.address)).eq("0")

    await latte.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 0
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(300 - 100, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 3, 18))

    await latte.removeExemption(user0.address)

    expect(await latte.getBurnAllowance(user0.address)).eq(expandDecimals(9, 18)) // 3% of 300

    await latte.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 1
    expect(await latte.balanceOf(user0.address)).eq(expandDecimals(300 - 100 - 100 - 1, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 3 - 1, 18))
  })
})
