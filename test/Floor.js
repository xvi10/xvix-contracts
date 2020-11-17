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

  it("updates capital", async () => {
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
    expect(await floor.getRefundAmount(burnAmount)).eq("2700000000000000000") // 10 / 1000 * 300 * 0.9
  })

  it("getRefundAmount can refund all capital", async () => {
    const burnAmount = expandDecimals(1000, 18)
    expect(await floor.getRefundAmount(burnAmount)).eq("0")

    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(300, 18) })
    expect(await floor.getRefundAmount(burnAmount)).eq(expandDecimals(300, 18))
  })

  it("getMaxMintAmount", async () => {
    expect(await floor.getMaxMintAmount("1")).eq("0")
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(200, 18) })
    expect(await floor.getMaxMintAmount("1")).eq("5") // 1000 / 200
  })

  it("refund", async () => {
    const receiver = "0xb47096ef9c4b2784025179ab2aea26b610e2f89f"
    const burnAmount = expandDecimals(10, 18)
    expect(await floor.getRefundAmount(burnAmount)).eq("0")

    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(300, 18) })
    expect(await floor.capital()).eq(expandDecimals(300, 18))
    expect(await floor.getRefundAmount(burnAmount)).eq("2700000000000000000") // 10 / 1000 * 300 * 0.9

    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(1000, 18))
    expect(await provider.getBalance(receiver)).eq("0")
    await floor.refund(receiver, burnAmount)
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(990, 18))
    expect(await provider.getBalance(receiver)).eq("2700000000000000000")

    expect(await floor.capital()).eq("297300000000000000000") // 300 - 2.7
    expect(await floor.getRefundAmount(burnAmount)).eq("2702727272727272727") // 10 / 990 * 297.3 * 0.9

    await floor.refund(receiver, burnAmount)
    expect(await xvix.balanceOf(wallet.address)).eq(expandDecimals(980, 18))
    expect(await provider.getBalance(receiver)).eq("5402727272727272727")
  })
})
