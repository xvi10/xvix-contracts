const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock } = require("./shared/utilities")
const { getLatestSlot, expectLedger } = require("./shared/xvix")

use(solidity)

describe("XVIX", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let xvix
  let minter
  let floor

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    xvix = fixtures.xvix
    minter = fixtures.minter
    floor = fixtures.floor
  })

  it("inits name", async () => {
    expect(await xvix.name()).eq("XVIX")
  })

  it("inits symbol", async () => {
    expect(await xvix.symbol()).eq("XVIX")
  })

  it("inits decimals", async () => {
    expect(await xvix.decimals()).eq(18)
  })

  it("inits website", async () => {
    expect(await xvix.website()).eq("https://xvix.finance/")
  })

  it("inits gov", async () => {
    expect(await xvix.gov()).eq(wallet.address)
  })

  it("inits max supply", async () => {
    expect(await xvix.maxSupply()).eq(expandDecimals(2000, 18))
  })

  it("inits ledger", async () => {
    const slot = await getLatestSlot(provider)
    await expectLedger(xvix, wallet.address, 0, 0, slot, expandDecimals(1000, 18))
  })

  it("setGov", async () => {
    await expect(xvix.connect(user0).setGov(user1.address))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    expect(await xvix.gov()).eq(user0.address)

    await xvix.connect(user0).setGov(user1.address)
    expect(await xvix.gov()).eq(user1.address)
  })

  it("setWebsite", async () => {
    await expect(xvix.connect(user0).setWebsite("xvixfi"))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    await xvix.connect(user0).setWebsite("xvixfi")
    expect(await xvix.website()).equal("xvixfi")
  })

  it("setMinter", async () => {
    await expect(xvix.connect(user0).setMinter(user1.address))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    await expect(xvix.connect(user0).setMinter(user1.address))
      .to.be.revertedWith("XVIX: minter already set")

    expect(await xvix.minter()).eq(minter.address)
  })

  it("setFloor", async () => {
    await expect(xvix.connect(user0).setFloor(user1.address))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    await expect(xvix.connect(user0).setFloor(user1.address))
      .to.be.revertedWith("XVIX: floor already set")

    expect(await xvix.floor()).eq(floor.address)
  })

  it("addExemption", async () => {
    await expect(xvix.connect(user0).addExemption(user1.address))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    expect(await xvix.exemptions(user1.address)).eq(false)
    await xvix.connect(user0).addExemption(user1.address)
    expect(await xvix.exemptions(user1.address)).eq(true)
  })

  it("removeExemption", async () => {
    await expect(xvix.connect(user0).removeExemption(user1.address))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    expect(await xvix.exemptions(user1.address)).eq(false)
    await xvix.connect(user0).addExemption(user1.address)
    expect(await xvix.exemptions(user1.address)).eq(true)

    await xvix.connect(user0).removeExemption(user1.address)
    expect(await xvix.exemptions(user1.address)).eq(false)
  })

  it("mint can be called by minter", async () => {
    const xvixMock = await deployContract("XVIX", ["10", "20"])
    await xvixMock.setMinter(user1.address)
    expect(await xvixMock.balanceOf(user1.address)).eq("0")

    await expect(xvixMock.connect(user0).mint(user1.address, "1"))
      .to.be.revertedWith("XVIX: forbidden")
    expect(await xvixMock.balanceOf(user1.address)).eq("0")

    await xvixMock.connect(user1).mint(user1.address, "7")
    expect(await xvixMock.balanceOf(user1.address)).eq("7")
    expect(await xvixMock.totalSupply()).eq("17")
  })

  it("burn fails unless sender is floor", async () => {
    const xvixMock = await deployContract("XVIX", ["10", "20"])
    await xvixMock.setMinter(user1.address)
    await xvixMock.connect(user1).mint(user0.address, "7")
    expect(await xvixMock.balanceOf(user0.address)).eq("7")
    expect(await xvixMock.totalSupply()).eq("17")

    await xvixMock.setFloor(user1.address)

    await expect(xvixMock.connect(user0).burn(user0.address, "2"))
      .to.be.revertedWith("XVIX: forbidden")
    expect(await xvixMock.balanceOf(user0.address)).eq("7")
  })

  it("transfer", async () => {
    expect(await minter.tokenReserve()).eq(expandDecimals(1000, 18))
    await xvix.transfer(user0.address, expandDecimals(200, 18)) // burn 2
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(200, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 2, 18))

    await xvix.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 1
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(200 - 100 - 1, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 2 - 1, 18))
    expect(await minter.tokenReserve()).eq(expandDecimals(1000 + 2 + 1, 18))
  })

  it("updates ledger", async () => {
    await expectLedger(xvix, user0.address, 0, 0, 0, 0)
    await expectLedger(xvix, user1.address, 0, 0, 0, 0)

    expect(await minter.tokenReserve()).eq(expandDecimals(1000, 18))
    await xvix.transfer(user0.address, expandDecimals(200, 18)) // burn 2
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(200, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 2, 18))

    const slot = await getLatestSlot(provider)
    await expectLedger(xvix, user0.address, 0, 0, slot, expandDecimals(200, 18))
    await expectLedger(xvix, user1.address, 0, 0, 0, 0)

    await xvix.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 1
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(200 - 100 - 1, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 2 - 1, 18))
    expect(await minter.tokenReserve()).eq(expandDecimals(1000 + 2 + 1, 18))

    await expectLedger(xvix, user0.address, 0, 0, slot, expandDecimals(99, 18))
    await expectLedger(xvix, user1.address, 0, 0, slot, expandDecimals(100, 18))
    expect(await xvix.getBurnAllowance(user0.address)).eq(0)
    expect(await xvix.getBurnAllowance(user1.address)).eq(0)

    await increaseTime(provider, 21 * 24 * 60 * 60)
    await mineBlock(provider)

    expect(await xvix.getBurnAllowance(user0.address)).eq("2970000000000000000") // 3% of 99
    expect(await xvix.getBurnAllowance(user1.address)).eq("3000000000000000000") // 3% of 100

    await xvix.connect(user1).toast("1000000000000000000")
    const allowance = await xvix.getBurnAllowance(user1.address)
    expect(await xvix.getBurnAllowance(user1.address)).eq("2000000000000000000")

    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(99, 18))
    expect(await xvix.balanceOf(user1.address)).eq(expandDecimals(99, 18))
    await xvix.connect(user0).roast(user1.address, user0.address)
    expect(await xvix.getBurnAllowance(user1.address)).eq("0")
     // 2/3 of burnt amount is paid as fees to user0
    expect(await xvix.balanceOf(user0.address)).eq("100333333333333333333")
    expect(await xvix.balanceOf(user1.address)).eq("95666666666666666667")

    await increaseTime(provider, 12 * 24 * 60 * 60)
    await mineBlock(provider)

    expect(await xvix.getBurnAllowance(user0.address)).eq("3009999999999999999") // 3% of 100.333...
    expect(await xvix.getBurnAllowance(user1.address)).eq("2870000000000000000") // 3% of 95.666...
  })

  it("toast", async () => {
    expect(await minter.tokenReserve()).eq(expandDecimals(1000, 18))
    await xvix.transfer(user0.address, expandDecimals(100, 18)) // burn 1
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(100, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 1, 18))
    expect(await minter.tokenReserve()).eq(expandDecimals(1000 + 1, 18))

    await xvix.connect(user0).toast(expandDecimals(7, 18)) // burn 7
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(93, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 1 - 7, 18))

    expect(await minter.tokenReserve()).eq(expandDecimals(1000 + 1 + 7, 18))
  })

  it("exempts", async () => {
    await xvix.transfer(user0.address, expandDecimals(300, 18)) // burn 3
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(300, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 3, 18))

    await increaseTime(provider, 12 * 24 * 60 * 60)
    await mineBlock(provider)

    await xvix.addExemption(user0.address)

    expect(await xvix.getBurnAllowance(user0.address)).eq("0")

    await xvix.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 0
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(300 - 100, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 3, 18))

    await xvix.removeExemption(user0.address)

    expect(await xvix.getBurnAllowance(user0.address)).eq(expandDecimals(9, 18)) // 3% of 300

    await xvix.connect(user0).transfer(user1.address, expandDecimals(100, 18)) // burn 1
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(300 - 100 - 100 - 1, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 3 - 1, 18))
  })
})
