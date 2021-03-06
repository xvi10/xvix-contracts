const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { bigNumberify, expandDecimals, increaseTime, mineBlock,
  reportGasUsed, getBlockTime } = require("./shared/utilities")
const { getRebaseTime, expectTransferConfig } = require("./shared/xvix")

use(solidity)

describe("XVIX", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet, user0, user1, user2] = provider.getWallets()
  let xvix
  let minter
  let floor
  let fund

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    minter = fixtures.minter
    floor = fixtures.floor
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
    expect(await xvix.defaultSenderBurnBasisPoints()).eq(0)
  })

  it("inits defaultSenderFundBasisPoints", async () => {
    expect(await xvix.defaultSenderFundBasisPoints()).eq(0)
  })

  it("inits defaultReceiverBurnBasisPoints", async () => {
    expect(await xvix.defaultReceiverBurnBasisPoints()).eq(43)
  })

  it("inits defaultReceiverFundBasisPoints", async () => {
    expect(await xvix.defaultReceiverFundBasisPoints()).eq(7)
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

  it("mint", async () => {
    const xvixMock = await deployContract("XVIX", ["10", "50", "100"])
    await xvixMock.setMinter(user1.address)
    expect(await xvixMock.balanceOf(user1.address)).eq("0")

    await expect(xvixMock.connect(user0).mint(user1.address, "1"))
      .to.be.revertedWith("XVIX: forbidden")
    expect(await xvixMock.balanceOf(user1.address)).eq("0")

    await xvixMock.connect(user1).mint(user1.address, "7")
    expect(await xvixMock.balanceOf(user1.address)).eq("7")
    expect(await xvixMock.totalSupply()).eq("17")

    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    await xvixMock.rebase()

    expect(await xvixMock.balanceOf(wallet.address)).eq("9")
    expect(await xvixMock.balanceOf(user1.address)).eq("6")
    expect(await xvixMock.totalSupply()).eq("16")

    await xvixMock.connect(user1).mint(user1.address, "9")

    expect(await xvixMock.balanceOf(wallet.address)).eq("9")
    expect(await xvixMock.balanceOf(user1.address)).eq("15")
    expect(await xvixMock.totalSupply()).eq("25")

    await xvixMock.createSafe(user1.address)

    expect(await xvixMock.balanceOf(wallet.address)).eq("9")
    expect(await xvixMock.balanceOf(user1.address)).eq("15")
    expect(await xvixMock.totalSupply()).eq("24")

    await increaseTime(provider, await getRebaseTime(provider, xvix, 10))
    await mineBlock(provider)
    await xvixMock.rebase()

    expect(await xvixMock.balanceOf(wallet.address)).eq("9")
    expect(await xvixMock.balanceOf(user1.address)).eq("15")
    expect(await xvixMock.totalSupply()).eq("24")

    await xvixMock.connect(user1).mint(user1.address, "9")

    await increaseTime(provider, await getRebaseTime(provider, xvix, 10))
    await mineBlock(provider)
    await xvixMock.rebase()

    expect(await xvixMock.balanceOf(wallet.address)).eq("9")
    expect(await xvixMock.balanceOf(user1.address)).eq("24")
    expect(await xvixMock.totalSupply()).eq("33")
  })

  it("burn", async () => {
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

    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    await xvixMock.rebase()

    expect(await xvixMock.balanceOf(user0.address)).eq("4")
    expect(await xvixMock.totalSupply()).eq("14")

    await xvixMock.connect(user1).burn(user0.address, "1")
    expect(await xvixMock.balanceOf(user0.address)).eq("3")
    expect(await xvixMock.totalSupply()).eq("13")

    await xvixMock.createSafe(user0.address)

    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    await xvixMock.rebase()

    expect(await xvixMock.balanceOf(user0.address)).eq("3")
    expect(await xvixMock.balanceOf(wallet.address)).eq("9")
    expect(await xvixMock.totalSupply()).eq("12")

    await xvixMock.connect(user1).burn(user0.address, "2")
    expect(await xvixMock.balanceOf(user0.address)).eq("1")
    expect(await xvixMock.totalSupply()).eq("10")
  })

  it("toast", async () => {
    const xvixMock = await deployContract("XVIX", ["10", "20", "100"])
    await xvixMock.setMinter(user1.address)
    await xvixMock.connect(user1).mint(user0.address, "7")
    expect(await xvixMock.balanceOf(user0.address)).eq("7")
    expect(await xvixMock.totalSupply()).eq("17")

    await expect(xvixMock.connect(user0).toast("2"))
      .to.be.revertedWith("XVIX: forbidden")
    expect(await xvixMock.balanceOf(user0.address)).eq("7")
    expect(await xvixMock.maxSupply()).eq("20")

    await xvixMock.setDistributor(user0.address)

    await xvixMock.connect(user0).toast("2")
    expect(await xvixMock.balanceOf(user0.address)).eq("5")
    expect(await xvixMock.totalSupply()).eq("15")
    expect(await xvixMock.maxSupply()).eq("18")
  })

  it("transfer normal => normal", async () => {
    await xvix.setDefaultTransferConfig(93, 7, 0, 0)
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
    await xvix.setDefaultTransferConfig(93, 7, 0, 0)
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
    await xvix.setDefaultTransferConfig(93, 7, 0, 0)
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
    await xvix.setDefaultTransferConfig(93, 7, 0, 0)
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

  it("createSafe", async () => {
    expect(await xvix.normalDivisor()).eq("100000000")
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await xvix.balances(wallet.address)).eq(expandDecimals(1000, 26))

    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)

    await xvix.rebase()
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq("999400239928014399998") // ~999.4
    expect(await xvix.balances(wallet.address)).eq(expandDecimals(1000, 26))
    expect(await xvix.totalSupply()).eq("999400239928014399998")
    expect(await xvix.normalSupply()).eq("999400239928014399998")
    expect(await xvix.safeSupply()).eq("0")

    expect(await xvix.safes(wallet.address)).eq(false)
    await xvix.createSafe(wallet.address)
    expect(await xvix.safes(wallet.address)).eq(true)

    await expect(xvix.createSafe(wallet.address))
      .to.be.revertedWith("XVIX: account is already a safe")

    expect(await xvix.balanceOf(wallet.address)).eq("999400239928014399998")
    expect(await xvix.balances(wallet.address)).eq("99940023992801439999827303638")
    expect(await xvix.totalSupply()).eq("999400239928014399998")
    expect(await xvix.normalSupply()).eq("0")
    expect(await xvix.safeSupply()).eq("999400239928014399998")
  })

  it("createSafe has onlyGov modifier", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])
    await expect(xvixMock.connect(user0).createSafe(wallet.address))
      .to.be.revertedWith("XVIX: forbidden")

    await xvixMock.setGov(user0.address)
    expect(await xvixMock.safes(wallet.address)).eq(false)
    await xvixMock.connect(user0).createSafe(wallet.address)
    expect(await xvixMock.safes(wallet.address)).eq(true)
  })

  it("destroySafe", async () => {
    await xvix.createSafe(wallet.address)

    expect(await xvix.normalDivisor()).eq("100000000")
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await xvix.balances(wallet.address)).eq(expandDecimals(1000, 26))

    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)

    await xvix.rebase()
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await xvix.balances(wallet.address)).eq(expandDecimals(1000, 26))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))
    expect(await xvix.normalSupply()).eq("0")
    expect(await xvix.safeSupply()).eq(expandDecimals(1000, 18))

    expect(await xvix.safes(wallet.address)).eq(true)
    await xvix.destroySafe(wallet.address)
    expect(await xvix.safes(wallet.address)).eq(false)

    await expect(xvix.destroySafe(wallet.address))
      .to.be.revertedWith("XVIX: account is not a safe")

    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await xvix.balances(wallet.address)).eq("100060012000000000000000000000")
    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))
    expect(await xvix.normalSupply()).eq(expandDecimals(1000, 18))
    expect(await xvix.safeSupply()).eq("0")
  })

  it("destroySafe has onlyGov, onlyAfterHandover modifiers", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])
    await xvixMock.createSafe(wallet.address)

    await expect(xvixMock.destroySafe(wallet.address))
      .to.be.revertedWith("XVIX: handover time has not passed")

    await increaseTime(provider, 200)
    await mineBlock(provider)

    await expect(xvixMock.connect(user0).destroySafe(wallet.address))
      .to.be.revertedWith("XVIX: forbidden")

    await xvixMock.setGov(user0.address)

    expect(await xvixMock.safes(wallet.address)).eq(true)
    await xvixMock.connect(user0).destroySafe(wallet.address)
    expect(await xvixMock.safes(wallet.address)).eq(false)
  })

  it("setRebaseConfig", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])

    await increaseTime(provider, 200)
    await mineBlock(provider)

    expect(await xvixMock.rebaseInterval()).eq(60 * 60)
    expect(await xvixMock.rebaseBasisPoints()).eq(2)

    await xvixMock.setRebaseConfig(30 * 60, 500)

    expect(await xvixMock.rebaseInterval()).eq(30 * 60)
    expect(await xvixMock.rebaseBasisPoints()).eq(500)

    await expect(xvixMock.setRebaseConfig(30 * 60 - 1, 2))
      .to.be.revertedWith("XVIX: rebaseInterval below limit")

    await expect(xvixMock.setRebaseConfig(7 * 24 * 60 * 60 + 1, 2))
      .to.be.revertedWith("XVIX: rebaseInterval exceeds limit")

    await expect(xvixMock.setRebaseConfig(7 * 24 * 60 * 60, 501))
      .to.be.revertedWith("XVIX: rebaseBasisPoints exceeds limit")
  })

  it("setRebaseConfig has onlyGov, onlyAfterHandover modifiers", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])

    await expect(xvixMock.setRebaseConfig(30 * 60, 500))
      .to.be.revertedWith("XVIX: handover time has not passed")

    await increaseTime(provider, 200)
    await mineBlock(provider)

    expect(await xvixMock.rebaseInterval()).eq(60 * 60)
    expect(await xvixMock.rebaseBasisPoints()).eq(2)

    await expect(xvixMock.connect(user0).setRebaseConfig(30 * 60, 500))
      .to.be.revertedWith("XVIX: forbidden")

    await xvixMock.setGov(user0.address)
    await xvixMock.connect(user0).setRebaseConfig(30 * 60, 500)

    expect(await xvixMock.rebaseInterval()).eq(30 * 60)
    expect(await xvixMock.rebaseBasisPoints()).eq(500)
  })

  it("setDefaultTransferConfig", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])

    await increaseTime(provider, 200)
    await mineBlock(provider)

    expect(await xvixMock.defaultSenderBurnBasisPoints()).eq(0)
    expect(await xvixMock.defaultSenderFundBasisPoints()).eq(0)
    expect(await xvixMock.defaultReceiverBurnBasisPoints()).eq(43)
    expect(await xvixMock.defaultReceiverFundBasisPoints()).eq(7)

    await xvixMock.setDefaultTransferConfig(1, 2, 3, 4)

    expect(await xvixMock.defaultSenderBurnBasisPoints()).eq(1)
    expect(await xvixMock.defaultSenderFundBasisPoints()).eq(2)
    expect(await xvixMock.defaultReceiverBurnBasisPoints()).eq(3)
    expect(await xvixMock.defaultReceiverFundBasisPoints()).eq(4)

    await expect(xvixMock.setDefaultTransferConfig(501, 2, 3, 4))
      .to.be.revertedWith("XVIX: senderBurnBasisPoints exceeds limit")

    await expect(xvixMock.setDefaultTransferConfig(1, 21, 3, 4))
      .to.be.revertedWith("XVIX: senderFundBasisPoints exceeds limit")

    await expect(xvixMock.setDefaultTransferConfig(1, 2, 501, 4))
      .to.be.revertedWith("XVIX: receiverBurnBasisPoints exceeds limit")

    await expect(xvixMock.setDefaultTransferConfig(1, 2, 3, 21))
      .to.be.revertedWith("XVIX: receiverFundBasisPoints exceeds limit")
  })

  it("setTransferConfig", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])
    const msgSender = "0x2690d5093fc7c6561e5ccf49aebebc8c7bd0c86f"
    await expectTransferConfig(xvixMock, msgSender, 0, 0, 0, 0)

    await xvixMock.setTransferConfig(msgSender, 1, 2, 3, 4)
    await expectTransferConfig(xvixMock, msgSender, 1, 2, 3, 4)

    await expect(xvixMock.setTransferConfig(msgSender, 501, 2, 3, 4))
      .to.be.revertedWith("XVIX: senderBurnBasisPoints exceeds limit")

    await expect(xvixMock.setTransferConfig(msgSender, 1, 21, 3, 4))
      .to.be.revertedWith("XVIX: senderFundBasisPoints exceeds limit")

    await expect(xvixMock.setTransferConfig(msgSender, 1, 2, 501, 4))
      .to.be.revertedWith("XVIX: receiverBurnBasisPoints exceeds limit")

    await expect(xvixMock.setTransferConfig(msgSender, 1, 2, 3, 21))
      .to.be.revertedWith("XVIX: receiverFundBasisPoints exceeds limit")
  })

  it("setTransferConfig has onlyGov modifier", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])
    const msgSender = "0x2690d5093fc7c6561e5ccf49aebebc8c7bd0c86f"
    await expectTransferConfig(xvixMock, msgSender, 0, 0, 0, 0)

    await expect(xvixMock.connect(user0).setTransferConfig(msgSender, 1, 2, 3, 4))
      .to.be.revertedWith("XVIX: forbidden")

    await xvixMock.setGov(user0.address)
    await xvixMock.connect(user0).setTransferConfig(msgSender, 1, 2, 3, 4)
    await expectTransferConfig(xvixMock, msgSender, 1, 2, 3, 4)
  })

  it("clearTransferConfig", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])
    const msgSender = "0x2690d5093fc7c6561e5ccf49aebebc8c7bd0c86f"
    await expectTransferConfig(xvixMock, msgSender, 0, 0, 0, 0)

    await xvixMock.setTransferConfig(msgSender, 1, 2, 3, 4)
    await expectTransferConfig(xvixMock, msgSender, 1, 2, 3, 4)

    await increaseTime(provider, 200)
    await mineBlock(provider)

    await xvixMock.clearTransferConfig(msgSender)
    await expectTransferConfig(xvixMock, msgSender, 0, 0, 0, 0)
  })

  it("clearTransferConfig has onlyGov, onlyAfterHandover modifiers", async () => {
    const blockTime = await getBlockTime(provider)
    const xvixMock = await deployContract("XVIX", [10, 10, blockTime + 100])
    const msgSender = "0x2690d5093fc7c6561e5ccf49aebebc8c7bd0c86f"

    await xvixMock.setTransferConfig(msgSender, 1, 2, 3, 4)

    await expect(xvixMock.clearTransferConfig(msgSender))
      .to.be.revertedWith("XVIX: handover time has not passed")

    await increaseTime(provider, 200)
    await mineBlock(provider)

    await expect(xvixMock.connect(user0).clearTransferConfig(msgSender))
      .to.be.revertedWith("XVIX: forbidden")

    await xvixMock.setGov(user0.address)
    await xvixMock.connect(user0).clearTransferConfig(msgSender)
    await expectTransferConfig(xvixMock, msgSender, 0, 0, 0, 0)
  })

  it("rebase", async () => {
    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    expect(await xvix.normalDivisor()).eq("100000000")
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))

    const tx0 = await xvix.rebase()
    await reportGasUsed(provider, tx0, "rebase0 gas used")
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq("999400239928014399998") // ~999.4

    const tx1 = await xvix.rebase()
    await reportGasUsed(provider, tx1, "rebase1 gas used")
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.balanceOf(wallet.address)).eq("999400239928014399998") // ~999.4

    await increaseTime(provider, await getRebaseTime(provider, xvix, 10000))
    const tx2 = await xvix.rebase()
    await reportGasUsed(provider, tx2, "rebase2 gas used")

    expect(await xvix.normalDivisor()).eq("100260312") // 100000000 * 100.02 ^ 13
    expect(await xvix.balanceOf(wallet.address)).eq("997403638640182966915") // ~997.4
  })

  it("updates allowances", async () => {
    await xvix.createSafe(wallet.address)
    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)
    await xvix.rebase()

    await xvix.transfer(user0.address, 1000)
    expect(await xvix.balanceOf(user0.address)).eq(995)
    await xvix.connect(user0).approve(user1.address, 500)
    expect(await xvix.allowance(user0.address, user1.address)).eq(500)

    expect(await xvix.balanceOf(user0.address)).eq(995)
    expect(await xvix.balanceOf(user1.address)).eq(0)
    await xvix.connect(user1).transferFrom(user0.address, user2.address, 200)

    expect(await xvix.balanceOf(user0.address)).eq(795)
    expect(await xvix.balanceOf(user2.address)).eq(199)
    expect(await xvix.allowance(user0.address, user1.address)).eq(300)

    await expect(xvix.connect(user1).transferFrom(user0.address, user2.address, 350))
      .to.be.revertedWith("XVIX: transfer amount exceeds allowance")
  })

  it("reverts transfer if sender has insufficient balance", async () => {
    await expect(xvix.transfer(wallet.address, expandDecimals(10000, 18)))
      .to.be.revertedWith("XVIX: subtraction amount exceeds balance")

    await xvix.createSafe(wallet.address)

    await expect(xvix.transfer(wallet.address, expandDecimals(10000, 18)))
      .to.be.revertedWith("XVIX: subtraction amount exceeds balance")
  })

  it("applies transfer configs", async () => {
    await xvix.setDefaultTransferConfig(100, 10, 200, 20)
    await xvix.setTransferConfig(user1.address, 200, 20, 400, 15)

    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await xvix.balanceOf(user0.address)).eq("0")
    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))

    await xvix.transfer(user0.address, expandDecimals(100, 18))

    expect(await xvix.balanceOf(wallet.address)).eq("898900000000000000000") // 898.9, 900 - 1.1
    expect(await xvix.balanceOf(user0.address)).eq("97800000000000000000") // 97.8, 100 - 2.2
    expect(await xvix.balanceOf(fund.address)).eq("300000000000000000") // 0.3, 0.3% of 100
    expect(await xvix.totalSupply()).eq("997000000000000000000") // 997, 1000 - 3

    await xvix.transfer(user1.address, expandDecimals(100, 18))
    expect(await xvix.balanceOf(wallet.address)).eq("797800000000000000000") // 797.8, 798.9 - 1.1
    expect(await xvix.balanceOf(user1.address)).eq("97800000000000000000") // 97.8, 100 - 2.2
    expect(await xvix.balanceOf(fund.address)).eq("600000000000000000") // 0.6, 0.3 + 0.3
    expect(await xvix.totalSupply()).eq("994000000000000000000") // 994, 997 - 3

    await xvix.connect(user1).transfer(user2.address, expandDecimals(10, 18))
    expect(await xvix.balanceOf(wallet.address)).eq("797800000000000000000") // 797.8, no change
    expect(await xvix.balanceOf(user1.address)).eq("87580000000000000000") // 87.58, 87.8 - 0.22
    expect(await xvix.balanceOf(user2.address)).eq("9585000000000000000") // 9.585, 10 - 0.415
    expect(await xvix.balanceOf(fund.address)).eq("635000000000000000") // 0.635, 0.3 + 0.3 + 0.035
    expect(await xvix.totalSupply()).eq("993400000000000000000") // 993.4, 994 - 0.6
  })

  it("updates nextRebaseTime", async () => {
    const rebaseTime = await xvix.nextRebaseTime()
    const expected = rebaseTime.add(60 * 60)
    expect(rebaseTime).gt(0)
    expect(rebaseTime.mod(60 * 60)).eq(0)
    await increaseTime(provider, 60 * 60 + 10)
    await mineBlock(provider)
    xvix.transfer(user1.address, 1)

    expect((await xvix.nextRebaseTime()).mod(60 * 60)).eq(0)
    expect(await xvix.nextRebaseTime()).eq(expected)
  })
})
