const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { bigNumberify, expandDecimals, increaseTime, mineBlock, reportGasUsed } = require("./shared/utilities")
const { getRebaseTime } = require("./shared/xvix")

use(solidity)

describe("XVIX", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let xvix
  let minter
  let floor
  let distributor
  let fund

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    xvix = fixtures.xvix
    minter = fixtures.minter
    floor = fixtures.floor
    distributor = fixtures.distributor
    fund = fixtures.fund
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

  it("inits minter", async () => {
    expect(await xvix.minter()).eq(minter.address)
  })

  it("inits floor", async () => {
    expect(await xvix.floor()).eq(floor.address)
  })

  it("inits distributor", async () => {
    expect(await xvix.distributor()).eq(distributor.address)
  })

  it("inits fund", async () => {
    expect(await xvix.fund()).eq(fund.address)
  })

  it("inits _normalSupply", async () => {
    const divisor = await xvix.normalDivisor()
    expect(await xvix._normalSupply()).eq(expandDecimals(1000, 18).mul(divisor))
  })

  it("inits _safeSupply", async () => {
    expect(await xvix._safeSupply()).eq(0)
  })

  it("inits totalSupply", async () => {
    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))
  })

  it("inits max supply", async () => {
    expect(await xvix.maxSupply()).eq(expandDecimals(2000, 18))
  })

  it("inits normalDivisor", async () => {
    expect(await xvix.normalDivisor()).eq(bigNumberify(10).pow(8))
  })

  it("inits rebaseInterval", async () => {
    expect(await xvix.rebaseInterval()).eq(60 * 60) // 1 hour
  })

  it("inits rebaseBasisPoints", async () => {
    expect(await xvix.rebaseBasisPoints()).eq(2)
  })

  it("inits nextRebaseTime", async () => {
    expect(await xvix.rebaseBasisPoints()).gt(0)
  })

  it("inits defaultSenderBurnBasisPoints", async () => {
    expect(await xvix.defaultSenderBurnBasisPoints()).eq(93)
  })

  it("inits defaultSenderFundBasisPoints", async () => {
    expect(await xvix.defaultSenderFundBasisPoints()).eq(7)
  })

  it("inits defaultReceiverBurnBasisPoints", async () => {
    expect(await xvix.defaultReceiverBurnBasisPoints()).eq(0)
  })

  it("inits defaultReceiverFundBasisPoints", async () => {
    expect(await xvix.defaultReceiverFundBasisPoints()).eq(0)
  })

  it("inits govHandoverTime", async () => {
    expect(await xvix.govHandoverTime()).gt(0)
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

  it("setDistributor", async () => {
    await expect(xvix.connect(user0).setDistributor(user1.address))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    await expect(xvix.connect(user0).setDistributor(user1.address))
      .to.be.revertedWith("XVIX: distributor already set")

    expect(await xvix.distributor()).eq(distributor.address)
  })

  it("setFund", async () => {
    await expect(xvix.connect(user0).setFund(user1.address))
      .to.be.revertedWith("XVIX: forbidden")
    await xvix.setGov(user0.address)

    await xvix.connect(user0).setFund(user1.address)
    expect(await xvix.fund()).eq(user1.address)
  })

  it("mint can be called by minter", async () => {
    const xvixMock = await deployContract("XVIX", ["10", "20", "100"])
    await xvixMock.setMinter(user1.address)
    expect(await xvixMock.balanceOf(user1.address)).eq("0")

    await expect(xvixMock.connect(user0).mint(user1.address, "1"))
      .to.be.revertedWith("XVIX: forbidden")
    expect(await xvixMock.balanceOf(user1.address)).eq("0")

    await xvixMock.connect(user1).mint(user1.address, "7")
    expect(await xvixMock.balanceOf(user1.address)).eq("7")
    expect(await xvixMock.totalSupply()).eq("17")
  })

  it("burn can be called by floor", async () => {
    const xvixMock = await deployContract("XVIX", ["10", "20", "100"])
    await xvixMock.setMinter(user1.address)
    await xvixMock.connect(user1).mint(user0.address, "7")
    expect(await xvixMock.balanceOf(user0.address)).eq("7")
    expect(await xvixMock.totalSupply()).eq("17")

    await xvixMock.setFloor(user1.address)

    await expect(xvixMock.connect(user0).burn(user0.address, "2"))
      .to.be.revertedWith("XVIX: forbidden")
    expect(await xvixMock.balanceOf(user0.address)).eq("7")

    await xvixMock.connect(user1).burn(user0.address, "2")
    expect(await xvixMock.balanceOf(user0.address)).eq("5")
    expect(await xvixMock.totalSupply()).eq("15")
  })

  it("transfer normal => normal", async () => {
    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    expect(await xvix.normalDivisor()).eq("100000000")
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))

    await xvix.rebase()
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq("999400239928014399998") // ~999.4
    expect(await xvix.balanceOf(user0.address)).eq("0")

    expect(await xvix.totalSupply()).eq("999400239928014399998") // ~999.4
    expect(await xvix.normalSupply()).eq("999400239928014399998") // ~999.4
    expect(await xvix._normalSupply()).eq(expandDecimals(10, 28))
    expect(await xvix._safeSupply()).eq("0")

    expect(await xvix.balanceOf(fund.address)).eq("0")

    await xvix.connect(wallet).transfer(user0.address, expandDecimals(10, 18))
    expect(await xvix.balanceOf(wallet.address)).eq("989300239928014399998") // ~989.3
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(10, 18))
    expect(await xvix.balanceOf(fund.address)).eq("7000000000000000") // 0.007, 0.07% of 10

    expect(await xvix.totalSupply()).eq("999307239928014399998") // ~999.3
    expect(await xvix.normalSupply()).eq("999307239928014399998")
    expect(await xvix._normalSupply()).eq("99990694418884000000000000000")

    expect(await xvix._safeSupply()).eq("0")
  })

  it("transfer normal => safe", async () => {
    await xvix.createSafe(user0.address)
    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    expect(await xvix.normalDivisor()).eq("100000000")
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))

    await xvix.rebase()
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq("999400239928014399998") // ~999.4
    expect(await xvix.balanceOf(user0.address)).eq("0")

    expect(await xvix.totalSupply()).eq("999400239928014399998") // ~999.4
    expect(await xvix.normalSupply()).eq("999400239928014399998") // ~999.4
    expect(await xvix._normalSupply()).eq(expandDecimals(10, 28))
    expect(await xvix._safeSupply()).eq("0")

    expect(await xvix.balanceOf(fund.address)).eq("0")

    const tx = await xvix.connect(wallet).transfer(user0.address, expandDecimals(10, 18))
    await reportGasUsed(provider, tx, "transfer gas used")
    expect(await xvix.balanceOf(wallet.address)).eq("989300239928014399998") // ~989.3
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(10, 18))
    expect(await xvix.balanceOf(fund.address)).eq("7000000000000000") // 0.007, 0.07% of 10

    expect(await xvix.totalSupply()).eq("999307239928014399998") // ~999.3
    expect(await xvix.normalSupply()).eq("989307239928014399998")
    expect(await xvix._normalSupply()).eq("98990094298884000000000000000")
    expect(await xvix.safeSupply()).eq(expandDecimals(10, 18))
    expect(await xvix._safeSupply()).eq(expandDecimals(10, 26))
  })

  it("transfer safe => normal", async () => {
    await xvix.createSafe(wallet.address)
    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    expect(await xvix.normalDivisor()).eq("100000000")
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))

    await xvix.rebase()
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await xvix.balanceOf(user0.address)).eq("0")

    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))
    expect(await xvix._normalSupply()).eq("0")
    expect(await xvix._safeSupply()).eq(expandDecimals(1000, 26))

    expect(await xvix.balanceOf(fund.address)).eq("0")

    await xvix.connect(wallet).transfer(user0.address, expandDecimals(10, 18))
    expect(await xvix.balanceOf(wallet.address)).eq("989900000000000000000") // 989.9
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(10, 18))
    expect(await xvix.balanceOf(fund.address)).eq("7000000000000000") // 0.007, 0.07% of 10

    expect(await xvix.totalSupply()).eq("999907000000000000000") // 999.907, 0.093 burnt
    expect(await xvix.normalSupply()).eq("10007000000000000000") // 10.007
    expect(await xvix._normalSupply()).eq("1001300540084000000000000000")
    expect(await xvix.safeSupply()).eq("989900000000000000000") // 989.9
    expect(await xvix._safeSupply()).eq("98990000000000000000000000000")
  })

  it("transfer safe => safe", async () => {
    await xvix.createSafe(wallet.address)
    await xvix.createSafe(user0.address)
    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    expect(await xvix.normalDivisor()).eq("100000000")
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))

    await xvix.rebase()
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await xvix.balanceOf(user0.address)).eq("0")

    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))
    expect(await xvix._normalSupply()).eq("0")
    expect(await xvix._safeSupply()).eq(expandDecimals(1000, 26))

    expect(await xvix.balanceOf(fund.address)).eq("0")

    await xvix.connect(wallet).transfer(user0.address, expandDecimals(10, 18))
    expect(await xvix.balanceOf(wallet.address)).eq("989900000000000000000") // 989.9
    expect(await xvix.balanceOf(user0.address)).eq(expandDecimals(10, 18))
    expect(await xvix.balanceOf(fund.address)).eq("7000000000000000") // 0.007, 0.07% of 10

    expect(await xvix.totalSupply()).eq("999907000000000000000") // 999.907, 0.093 burnt
    expect(await xvix.normalSupply()).eq("7000000000000000")
    expect(await xvix._normalSupply()).eq("700420084000000000000000")
    expect(await xvix.safeSupply()).eq("999900000000000000000") // 999.9
    expect(await xvix._safeSupply()).eq("99990000000000000000000000000")
  })
})
