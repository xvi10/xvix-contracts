const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { mineBlock, increaseTime, expandTo18Decimals } = require("./shared/utilities")
const { addLiquidityETH } = require("./shared/uniswap")

use(solidity)

describe("Pricer", function() {
  const provider = waffle.provider
  const [wallet] = provider.getWallets()
  let latte
  let router
  let pricer
  let pair

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    router = fixtures.router
    pricer = fixtures.pricer
    pair = fixtures.pair
    await addLiquidityETH({
      router,
      wallet,
      token: latte,
      amountToken: expandTo18Decimals(10),
      amountETH: expandTo18Decimals(4)
    })
  })

  it("sets use0", async () => {
    const token0 = await pair.token0()
    const shouldUse0 = token0 == latte.address
    expect(await pricer.use0()).eq(shouldUse0)
  })

  it("updates price parameters", async () => {
    expect(await pricer.p1()).eq(0)
    expect(await pricer.t1()).eq(0)
    expect(await pricer.lastPrice()).eq(0)
    await pricer.update()
  })
})
