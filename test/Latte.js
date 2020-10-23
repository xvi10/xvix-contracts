const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { increaseTime, expandDecimals } = require("./shared/utilities")

use(solidity)

describe("Latte", function() {
  const provider = waffle.provider
  const [wallet] = provider.getWallets()
  let latte

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
  })

  it("inits snapshotTime", async () => {
    expect(await latte.snapshotTime()).gt(0)
  })

  it("inits supplySnapshot", async () => {
    expect(await latte.supplySnapshot()).eq(expandDecimals(10000, 18))
  })

  it("updates snapshotTime", async () => {
    const blockTime = await latte.snapshotTime()

    await increaseTime(provider, 20 * 60)
    await latte.update()
    expect(await latte.snapshotTime()).eq(blockTime)

    await increaseTime(provider, 20 * 60)
    await latte.update()
    expect(await latte.snapshotTime()).gt(blockTime)
  })
})
