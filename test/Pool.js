const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals } = require("./shared/utilities")

use(solidity)

describe("Pool", function() {
  const provider = waffle.provider
  const [wallet, user0] = provider.getWallets()
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
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000, 18))
    const burnAmount = expandDecimals(10, 18)
    expect(await pool.capital()).eq("0")
    await expect(pool.refund(user0.address, burnAmount))
      .to.be.revertedWith("Pool: refund amount is zero")

    const funding = expandDecimals(300, 18)
    await wallet.sendTransaction({ to: pool.address, value: funding })
    expect(await pool.capital()).eq(funding)
    await expect(pool.refund(user0.address, "1"))
      .to.be.revertedWith("Pool: refund amount is zero")

    expect(await pool.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18))

    const userBalance0 = await provider.getBalance(user0.address)
    expect(await latte.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000, 18))

    await pool.refund(user0.address, burnAmount)
    const ethReceived = (await provider.getBalance(user0.address)).sub(userBalance0)
    expect(ethReceived).eq(expandDecimals(3, 18))
    expect(await latte.balanceOf(wallet.address)).eq(expandDecimals(1000 - 10, 18))
    expect(await latte.totalSupply()).eq(expandDecimals(1000 - 10, 18))

    expect(await pool.capital()).eq(expandDecimals(300 - 3, 18))
    expect(await pool.getRefundAmount(burnAmount)).eq(expandDecimals(3, 18))

    expect(await cafe.tokenReserve()).eq(expandDecimals(1010, 18))
  })
})
