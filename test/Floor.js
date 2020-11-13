const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock } = require("./shared/utilities")
const { getLatestSlot, expectLedger } = require("./shared/xvix")

use(solidity)

describe("Floor", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let xvix
  let floor
  let minter

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    xvix = fixtures.xvix
    floor = fixtures.floor
    minter = fixtures.minter
  })

  it("fund", async () => {
    expect(await provider.getBalance(floor.address)).eq("0")
    expect(await floor.capital()).eq("0")

    const funding = expandDecimals(7, 18)
    await wallet.sendTransaction({ to: floor.address, value: funding })

    expect(await provider.getBalance(floor.address)).eq(funding)
    expect(await floor.capital()).eq(funding)
  })

  it("getRefundAmount", async () => {
    const burnAmount = expandDecimals(10, 18)
    expect(await floor.getRefundAmount(burnAmount)).eq("0")

    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(300, 18) })
    expect(await floor.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18)) // 10 / 1000 * 300
  })

  it("getMintAmount", async () => {
    expect(await floor.getMintAmount("1")).eq("0")
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(200, 18) })
    expect(await floor.getMintAmount("1")).eq("5")
  })

  it("refund", async () => {
    const transferAmount = expandDecimals(100, 18)
    await xvix.transfer(user0.address, transferAmount) // 1 burnt
    const slot = await getLatestSlot(provider)
    await expectLedger(xvix, user0.address, 0, 0, slot, transferAmount)

    await increaseTime(provider, 8 * 24 * 60 * 60)
    await mineBlock(provider)

    const newSlot = await getLatestSlot(provider)

    const burnAmount = expandDecimals(10, 18)
    expect(await minter.tokenReserve()).eq(expandDecimals(1001, 18))
    expect(await floor.capital()).eq("0")
    await expect(floor.connect(user0).refund(user1.address, burnAmount))
      .to.be.revertedWith("Floor: refund amount is zero")

    const funding = expandDecimals(2997, 17) // (1000 - 1) * 3
    await wallet.sendTransaction({ to: floor.address, value: funding })
    expect(await floor.capital()).eq(funding)
    await expect(floor.connect(user0).refund(user1.address, "1"))
      .to.be.revertedWith("Floor: refund amount is zero")

    expect(await floor.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18))

    const userBalance1 = await provider.getBalance(user1.address)
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000 - 100 - 1, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(999, 18))

    await expectLedger(xvix, user0.address, 0, 0, slot, transferAmount)
    await expectLedger(xvix, user1.address, 0, 0, 0, 0)

    expect(await xvix.getBurnAllowance(user0.address)).eq(expandDecimals(3, 18))
    expect(await xvix.getBurnAllowance(user1.address)).eq("0")
    await floor.connect(user0).refund(user1.address, burnAmount)
    expect(await xvix.getBurnAllowance(user0.address)).eq(expandDecimals(3, 18))
    expect(await xvix.getBurnAllowance(user1.address)).eq("0")

    await expectLedger(xvix, user0.address, slot, transferAmount, newSlot, transferAmount.sub(burnAmount))
    await expectLedger(xvix, user1.address, 0, 0, 0, 0)

    const ethReceived = (await provider.getBalance(user1.address)).sub(userBalance1)
      expect(ethReceived).eq(expandDecimals(3, 18))
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000 - 100 - 1, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1000 - 1 - 10, 18))

    expect(await floor.capital()).eq(expandDecimals(2997 - 30, 17))
    expect(await floor.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18))

    expect(await minter.tokenReserve()).eq(expandDecimals(1000 + 1 + 10, 18))
  })
})
