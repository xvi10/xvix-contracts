const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock,
  reportGasUsed, getBlockTime } = require("./shared/utilities")

use(solidity)

describe("TimeVault", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let xvix
  let vault

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    vault = await deployContract("TimeVault", [xvix.address])
    await xvix.createSafe(vault.address)
    await xvix.setTransferConfig(vault.address, 0, 0, 0, 0)
  })

  it("inits", async () => {
    expect(await vault.token()).eq(xvix.address)
  })

  it("deposit", async () => {
    await expect(vault.connect(user0).deposit(0))
      .to.be.revertedWith("TimeVault: insufficient amount")
    await expect(vault.connect(user0).deposit(100))
      .to.be.revertedWith("XVIX: transfer amount exceeds allowance")

    await xvix.connect(user0).approve(vault.address, 100)
    await expect(vault.connect(user0).deposit(100))
      .to.be.revertedWith("XVIX: subtraction amount exceeds balance")

    await xvix.transfer(user0.address, 1000)
    expect(await xvix.balanceOf(user0.address)).eq(995)

    await xvix.connect(user0).approve(vault.address, 100)
    const tx = await vault.connect(user0).deposit(100)
    await reportGasUsed(provider, tx, "deposit gas used")
    expect(await xvix.balanceOf(user0.address)).eq(895)
    expect(await xvix.balanceOf(vault.address)).eq(100)
    expect(await vault.balanceOf(user0.address)).eq(100)
  })

  it("beginWithdrawal", async () => {
    await expect(vault.connect(user0).beginWithdrawal(0))
      .to.be.revertedWith("TimeVault: insufficient amount")

    await xvix.transfer(user0.address, 1000)
    expect(await xvix.balanceOf(user0.address)).eq(995)

    await xvix.connect(user0).approve(vault.address, 100)
    await vault.connect(user0).deposit(100)

    expect(await xvix.balanceOf(user0.address)).eq(895)
    expect(await xvix.balanceOf(vault.address)).eq(100)
    expect(await vault.balanceOf(user0.address)).eq(100)

    await expect(vault.connect(user0).beginWithdrawal(101))
      .to.be.revertedWith("TimeVault: insufficient balance")

    expect(await vault.withdrawalTimestamps(user0.address)).eq(0)
    expect(await vault.withdrawalAmounts(user0.address)).eq(0)
    const tx = await vault.connect(user0).beginWithdrawal(100)
    await reportGasUsed(provider, tx, "beginWithdrawal gas used")
    expect(await vault.withdrawalTimestamps(user0.address)).gt(0)
    expect(await vault.withdrawalAmounts(user0.address)).eq(100)
  })

  it("withdraw", async () => {
    await xvix.transfer(user0.address, expandDecimals(100, 18))
    expect(await xvix.balanceOf(user0.address)).eq("99500000000000000000")

    await xvix.connect(user0).approve(vault.address, expandDecimals(10, 18))
    await vault.connect(user0).deposit(expandDecimals(10, 18))

    expect(await xvix.balanceOf(user0.address)).eq("89500000000000000000")
    expect(await xvix.balanceOf(vault.address)).eq(expandDecimals(10, 18))
    expect(await vault.balanceOf(user0.address)).eq(expandDecimals(10, 18))

    await expect(vault.connect(user0).withdraw(user1.address))
      .to.be.revertedWith("TimeVault: withdrawal not initiated")

    await vault.connect(user0).beginWithdrawal(expandDecimals(10, 18))

    await expect(vault.connect(user0).withdraw(user1.address))
      .to.be.revertedWith("TimeVault: withdrawal timing not reached")

    await increaseTime(provider, 7 * 24 * 60 * 60 - 10)
    await mineBlock(provider)

    await expect(vault.connect(user0).withdraw(user1.address))
      .to.be.revertedWith("TimeVault: withdrawal timing not reached")

    await increaseTime(provider, 20)
    await mineBlock(provider)

    expect(await xvix.balanceOf(user1.address)).eq(0)
    const tx = await vault.connect(user0).withdraw(user1.address)
    await reportGasUsed(provider, tx, "withdraw gas used")
    expect(await xvix.balanceOf(vault.address)).eq(0)
    expect(await xvix.balanceOf(user1.address)).eq(expandDecimals(10, 18))
    expect(await vault.balanceOf(user1.address)).eq(0)
    expect(await vault.withdrawalTimestamps(user0.address)).eq(0)
    expect(await vault.withdrawalAmounts(user0.address)).eq(0)

    await expect(vault.connect(user0).withdraw(user1.address))
      .to.be.revertedWith("TimeVault: withdrawal not initiated")
  })

  it("withdrawalSlots", async () => {
    const delay = 7 * 24 * 60 * 60
    const windowSize = 48 * 60 * 60
    const time = await getBlockTime(provider)
    const slot = parseInt((time + delay) / windowSize)

    await xvix.transfer(user0.address, expandDecimals(100, 18))
    await xvix.connect(user0).approve(vault.address, expandDecimals(10, 18))
    await vault.connect(user0).deposit(expandDecimals(10, 18))

    await vault.connect(user0).beginWithdrawal(expandDecimals(10, 18))
    expect(await vault.withdrawalSlots(slot)).eq(expandDecimals(10, 18))

    await xvix.transfer(user1.address, expandDecimals(50, 18))
    await xvix.connect(user1).approve(vault.address, expandDecimals(5, 18))
    await vault.connect(user1).deposit(expandDecimals(5, 18))

    await vault.connect(user1).beginWithdrawal(expandDecimals(5, 18))
    expect(await vault.withdrawalSlots(slot)).eq(expandDecimals(15, 18))

    await increaseTime(provider, 8 * 24 * 60 * 60)
    await mineBlock(provider)

    await vault.connect(user0).withdraw(user0.address)
    expect(await vault.withdrawalSlots(slot)).eq(expandDecimals(5, 18))

    await increaseTime(provider, 24 * 60 * 60 + 10)
    await mineBlock(provider)

    await expect(vault.connect(user1).withdraw(user1.address))
      .to.be.revertedWith("TimeVault: withdrawal window already passed")

    const nextTime = await getBlockTime(provider)
    const nextSlot = parseInt((nextTime + delay) / windowSize)

    expect(await vault.withdrawalSlots(nextSlot)).eq(0)
    await vault.connect(user1).beginWithdrawal(expandDecimals(5, 18))
    expect(await vault.withdrawalSlots(slot)).eq(0)
    expect(await vault.withdrawalSlots(nextSlot)).eq(expandDecimals(5, 18))
  })
})
