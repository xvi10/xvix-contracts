const { deployContract } = require("ethereum-waffle")
const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals } = require("./shared/utilities")
const { addLiquidityETH, buyTokens } = require("./shared/uniswap")

const Pricer = require("../artifacts/Pricer.json")

use(solidity)

describe("Pricer", function() {
  const provider = waffle.provider
  const [wallet, user] = provider.getWallets()
  let latte
  let weth
  let router
  let pricer
  let pair

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    pair = fixtures.pair
    await addLiquidityETH({
      router,
      wallet,
      token: latte,
      amountToken: expandDecimals(10, 18),
      amountETH: expandDecimals(4, 18)
    })

    pricer = await deployContract(wallet, Pricer, [pair.address, latte.address])
    await latte.setPricer(pricer.address)
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

    await buyTokens({
      router,
      wallet,
      weth,
      token: latte,
      amountETH: expandDecimals(1, 18)
    })
    await buyTokens({
      router,
      wallet,
      weth,
      token: latte,
      amountETH: expandDecimals(1, 18)
    })

    console.log('p1', (await pricer.p1()).toString())
    console.log('t1', (await pricer.t1()).toString())
    console.log('lastprice', (await pricer.lastPrice()).toString())
  })
})
