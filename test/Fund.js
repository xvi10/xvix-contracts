const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")

use(solidity)

describe("Fund", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()
  let xvix
  let fund

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    fund = await deployContract("Fund", [user0.address, user1.address])
    xvix = fixtures.xvix
  })

  it("inits", async () => {
    expect(await fund.receiverA()).eq(user0.address)
    expect(await fund.receiverB()).eq(user1.address)
  })

  it("setReceiverA", async () => {
    await expect(fund.connect(user1).setReceiverA(user2.address))
      .to.be.revertedWith("Fund: forbidden")

    await fund.connect(user0).setReceiverA(user2.address)
    expect(await fund.receiverA()).eq(user2.address)

    await fund.connect(user2).setReceiverA(user0.address)
    expect(await fund.receiverA()).eq(user0.address)
  })

  it("setReceiverB", async () => {
    await expect(fund.connect(user0).setReceiverB(user3.address))
      .to.be.revertedWith("Fund: forbidden")

    await fund.connect(user1).setReceiverB(user3.address)
    expect(await fund.receiverB()).eq(user3.address)

    await fund.connect(user3).setReceiverB(user1.address)
    expect(await fund.receiverB()).eq(user1.address)
  })

  it("withdraw", async () => {
    xvix.setFund(fund.address)

    expect(await xvix.balanceOf(fund.address)).eq(0)
    xvix.transfer(user2.address, 1000000)
    expect(await xvix.balanceOf(fund.address)).eq(700)

    await expect(fund.connect(wallet).withdraw(xvix.address, 100))
      .to.be.revertedWith("Fund: forbidden")

    await fund.connect(user0).withdraw(xvix.address, 100)

    expect(await xvix.balanceOf(user0.address)).eq(90)
    expect(await xvix.balanceOf(user1.address)).eq(10)
  })
})
