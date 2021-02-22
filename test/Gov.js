const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { increaseTime, mineBlock, getBlockTime } = require("./shared/utilities")
const { expectTransferConfig } = require("./shared/xvix")

use(solidity)

describe("Gov", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()
  let xvix
  let fund
  let gov
  let govHandoverTime

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    govHandoverTime = (await getBlockTime(provider))
    xvix = fixtures.xvix
    fund = fixtures.fund
    gov = await deployContract("Gov", [xvix.address, govHandoverTime])
    await xvix.setGov(gov.address)
  })

  it("inits", async () => {
    expect(await gov.xvix()).eq(xvix.address)
    expect(await gov.govHandoverTime()).eq(govHandoverTime)
    expect(await gov.admin()).eq(wallet.address)
    expect(await xvix.gov()).eq(gov.address)
  })

  it("setAdmin", async () => {
    await expect(gov.connect(user0).setAdmin(user0.address))
      .to.be.revertedWith("Gov: forbidden")
    expect(await gov.admin()).eq(wallet.address)

    await gov.setAdmin(user0.address)
    expect(await gov.admin()).eq(user0.address)

    await gov.connect(user0).setAdmin(user1.address)
    expect(await gov.admin()).eq(user1.address)
  })

  it("extendHandoverTime", async () => {
    await expect(gov.connect(user0).extendHandoverTime(govHandoverTime - 1))
      .to.be.revertedWith("Gov: forbidden")

    await gov.setAdmin(user0.address)

    await expect(gov.connect(user0).extendHandoverTime(govHandoverTime - 1))
      .to.be.revertedWith("Gov: invalid handover time")

    await gov.connect(user0).extendHandoverTime(govHandoverTime + 1)

    expect(await gov.govHandoverTime()).eq(govHandoverTime + 1)
  })

  it("setGov", async () => {
    await gov.setAdmin(user0.address)
    gov.connect(user0).extendHandoverTime(govHandoverTime + 100)
    await expect(gov.connect(user1).setGov(user2.address))
      .to.be.revertedWith("Gov: forbidden")
    await expect(gov.connect(user0).setGov(user2.address))
      .to.be.revertedWith("Gov: handover time has not passed")

    await increaseTime(provider, 200)
    await mineBlock(provider)

    expect(await xvix.gov()).eq(gov.address)
    await gov.connect(user0).setGov(user2.address)

    expect(await xvix.gov()).eq(user2.address)
  })

  it("setFund", async () => {
    await gov.setAdmin(user0.address)
    gov.connect(user0).extendHandoverTime(govHandoverTime + 100)
    await expect(gov.connect(user1).setFund(user3.address))
      .to.be.revertedWith("Gov: forbidden")

    expect(await xvix.fund()).eq(fund.address)
    await gov.connect(user0).setFund(user3.address)
    expect(await xvix.fund()).eq(user3.address)
  })

  it("createSafe", async () => {
    await gov.setAdmin(user0.address)
    gov.connect(user0).extendHandoverTime(govHandoverTime + 100)
    await expect(gov.connect(user1).createSafe(user3.address))
      .to.be.revertedWith("Gov: forbidden")

    expect(await xvix.safes(user3.address)).eq(false)
    await gov.connect(user0).createSafe(user3.address)
    expect(await xvix.safes(user3.address)).eq(true)
  })

  it("setTransferConfig", async () => {
    await gov.setAdmin(user0.address)
    gov.connect(user0).extendHandoverTime(govHandoverTime + 100)
    await expect(gov.connect(user1).setTransferConfig(user3.address, 1, 2, 3, 4))
      .to.be.revertedWith("Gov: forbidden")

    await expectTransferConfig(xvix, user3.address, 0, 0, 0, 0)
    await gov.connect(user0).setTransferConfig(user3.address, 1, 2, 3, 4)
    await expectTransferConfig(xvix, user3.address, 1, 2, 3, 4)
  })
})
