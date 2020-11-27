const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { increaseTime, mineBlock } = require("./shared/utilities")

use(solidity)

describe("Timelock", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet, user0, user1, user2] = provider.getWallets()
  let xvix
  let fund
  let timelock

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    fund = fixtures.fund
    timelock = await deployContract("Timelock", [xvix.address])
  })

  it("inits", async () => {
    expect(await timelock.xvix()).eq(xvix.address)
    expect(await timelock.owner()).eq(wallet.address)
  })

  it("suggestGov", async () => {
    await expect(timelock.connect(user0).suggestGov(user1.address))
      .to.be.revertedWith("Timelock: forbidden")

    await expect(timelock.suggestGov(ethers.constants.AddressZero))
      .to.be.revertedWith("Timelock: gov address is empty")

    expect(await timelock.unlockTime()).eq(0)
    expect(await timelock.nextGov()).eq(ethers.constants.AddressZero)

    await timelock.suggestGov(user1.address)

    expect(await timelock.unlockTime()).gt(0)
    expect(await timelock.nextGov()).eq(user1.address)
  })

  it("setGov", async () => {
    await xvix.setGov(timelock.address)
    await expect(timelock.connect(user0).setGov())
      .to.be.revertedWith("Timelock: forbidden")

    await expect(timelock.setGov())
      .to.be.revertedWith("Timelock: not unlocked")

    await timelock.suggestGov(user1.address)

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await expect(timelock.setGov())
      .to.be.revertedWith("Timelock: not unlocked")

    await increaseTime(provider, 4 * 24 * 60 * 60 + 10)
    await mineBlock(provider)

    await expect(xvix.connect(user1).setFund(user2.address))
      .to.be.revertedWith("XVIX: forbidden")
    expect(await xvix.fund()).eq(fund.address)
    expect(await xvix.gov()).eq(timelock.address)

    await timelock.setGov()
    expect(await xvix.gov()).eq(user1.address)

    await xvix.connect(user1).setFund(user2.address)
    expect(await xvix.fund()).eq(user2.address)
  })
})
