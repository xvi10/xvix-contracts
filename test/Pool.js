const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals } = require("./shared/utilities")
const { getLatestSlot, expectLedger } = require("./shared/latte")

use(solidity)

describe("Pool", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let pool
  let cafe

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    pool = fixtures.pool
    cafe = fixtures.cafe
  })

  it("fund", async () => {
    expect(await provider.getBalance(pool.address)).eq("0")
    expect(await pool.capital()).eq("0")

    const funding = expandDecimals(7, 18)
    await wallet.sendTransaction({ to: pool.address, value: funding })

    expect(await provider.getBalance(pool.address)).eq(funding)
    expect(await pool.capital()).eq(funding)
  })

  it("getRefundAmount", async () => {
    const burnAmount = expandDecimals(10, 18)
    expect(await pool.getRefundAmount(burnAmount)).eq("0")

    await wallet.sendTransaction({ to: pool.address, value: expandDecimals(300, 18) })
    expect(await pool.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18)) // 10 / 1000 * 300
  })

  it("getMintAmount", async () => {
    expect(await pool.getMintAmount("1")).eq("0")
    await wallet.sendTransaction({ to: pool.address, value: expandDecimals(200, 18) })
    expect(await pool.getMintAmount("1")).eq("5")
  })

  it("refund", async () => {
    const transferAmount = expandDecimals(100, 18)
    await latte.transfer(user0.address, transferAmount) // 1 burnt
    const slot = await getLatestSlot(provider)
    await expectLedger(latte, user0.address, 0, 0, slot, transferAmount)

    const burnAmount = expandDecimals(10, 18)
    expect(await cafe.tokenReserve()).eq(expandDecimals(1001, 18))
    expect(await pool.capital()).eq("0")
    await expect(pool.connect(user0).refund(user1.address, burnAmount))
      .to.be.revertedWith("Pool: refund amount is zero")

    const funding = expandDecimals(2997, 17) // (1000 - 1) * 3
    await wallet.sendTransaction({ to: pool.address, value: funding })
    expect(await pool.capital()).eq(funding)
    await expect(pool.connect(user0).refund(user1.address, "1"))
      .to.be.revertedWith("Pool: refund amount is zero")

    expect(await pool.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18))

    const userBalance1 = await provider.getBalance(user1.address)
    expect(await latte.balanceOf(wallet.address)).eq(expandDecimals(1000 - 100 - 1, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(999, 18))

    await expectLedger(latte, user0.address, 0, 0, slot, transferAmount)
    await expectLedger(latte, user1.address, 0, 0, 0, 0)

    await pool.connect(user0).refund(user1.address, burnAmount)

    await expectLedger(latte, user0.address, 0, 0, slot, transferAmount.sub(burnAmount))
    await expectLedger(latte, user1.address, 0, 0, 0, 0)

    const ethReceived = (await provider.getBalance(user1.address)).sub(userBalance1)
      expect(ethReceived).eq(expandDecimals(3, 18))
    expect(await latte.balanceOf(wallet.address)).eq(expandDecimals(1000 - 100 - 1, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 1 - 10, 18))

    expect(await pool.capital()).eq(expandDecimals(2997 - 30, 17))
    expect(await pool.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18))

    expect(await cafe.tokenReserve()).eq(expandDecimals(1000 + 1 + 10, 18))
  })
})
