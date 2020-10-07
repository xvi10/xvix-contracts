const { expect, use } = require("chai")
const { MockProvider, solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { mineBlock, increaseTime } = require("./shared/utilities")

use(solidity)

describe("Latte", function() {
  const provider = new MockProvider()
  const [wallet] = provider.getWallets()
  let latte

  beforeEach(async () => {
    const fixtures = await loadFixtures(wallet)
    latte = fixtures.latte
  })

  it("inits latestBlockTime", async () => {
    expect(await latte.latestBlockTime()).gt(0)
  })

  it("updates latestBlockTime", async () => {
    const blockTime = await latte.latestBlockTime()

    await increaseTime(provider, 20 * 60)
    await latte.update()
    expect(await latte.latestBlockTime()).eq(blockTime)

    await increaseTime(provider, 20 * 60)
    await latte.update()
    expect(await latte.latestBlockTime()).gt(blockTime)
  })
})
