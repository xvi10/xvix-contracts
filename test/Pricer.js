const { deployContract } = require("ethereum-waffle")
const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock, gasUsed } = require("./shared/utilities")
const { addLiquidityETH, buyTokens, sellTokens } = require("./shared/uniswap")
const { expectBetween } = require("./shared/waffle")

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
    pricer = fixtures.pricer

    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
  })

  it("sets use0", async () => {
    const token0 = await pair.token0()
    const shouldUse0 = token0 == latte.address
    expect(await pricer.use0()).eq(shouldUse0)
  })

  it("updates when price is increasing", async () => {
    expect(await pricer.cp0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.cp1()).eq(0)
    expect(await pricer.t1()).eq(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    const amountETH = expandDecimals(1, 18)
    // pricer.update is invoked on latte transfers
    // buyTokens should be called twice since the transfer happens
    // before prices are updated in the uniswap pool
    const tx0 = await buyTokens({ router, wallet, weth, token: latte, amountETH })
    const tx1 = await buyTokens({ router, wallet, weth, token: latte, amountETH })
    // log gasUsed to check the additional gas needed between txns
    console.log("tx0 gasUsed", (await gasUsed(provider, tx0)).toString())
    console.log("tx1 gasUsed", (await gasUsed(provider, tx1)).toString())

    expect(await pricer.cp0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.cp1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    const tx2 = await buyTokens({ router, wallet, weth, token: latte, amountETH })
    const tx3 = await buyTokens({ router, wallet, weth, token: latte, amountETH })
    // log gasUsed to check the additional gas needed between txns
    console.log("tx2 gasUsed", (await gasUsed(provider, tx2)).toString())
    console.log("tx3 gasUsed", (await gasUsed(provider, tx3)).toString())

    expect(await pricer.cp0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.cp1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    const tx4 = await buyTokens({ router, wallet, weth, token: latte, amountETH })
    const tx5 = await buyTokens({ router, wallet, weth, token: latte, amountETH })
    // log gasUsed to check the additional gas needed between txns
    console.log("tx4 gasUsed", (await gasUsed(provider, tx4)).toString())
    console.log("tx5 gasUsed", (await gasUsed(provider, tx5)).toString())

    expect(await pricer.cp0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.cp1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).gt(0)
    expect(await pricer.hasIncreasingPrice()).eq(true)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    const lastPrice0 = await pricer.lastPrice()
    const amountIn = expandDecimals(1, 18)
    // use ranges to compare instead of eq because there will be slight variations in the
    // different block.timestamps used for calculations between runs
    // 2.45, which is close to 1000 / 400 = 2.5
    expectBetween(await pricer.tokensForEth(amountIn), "2450000000000000000", "2451000000000000000")
    // 0.408, which is close to 400 / 1000 = 0.4
    expectBetween(await pricer.ethForTokens(amountIn), "408000000000000000", "408100000000000000")

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    expect(await pricer.lastPrice()).gt(lastPrice0)

    const lastPrice1 = await pricer.lastPrice()
    // 2.426, the tokens to be received should decrease
    expectBetween(await pricer.tokensForEth(amountIn), "2426000000000000000", "2427000000000000000")
    // 0.412, the eth to be received should increase
    expectBetween(await pricer.ethForTokens(amountIn), "412000000000000000", "412100000000000000")

    expect(await pricer.hasIncreasingPrice()).eq(true)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 20 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    // lastPrice should not change because the current interval has not passed
    expect(await pricer.lastPrice()).eq(lastPrice1)
  })

  it("updates when price is decreasing", async () => {
    expect(await pricer.cp0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.cp1()).eq(0)
    expect(await pricer.t1()).eq(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    const amountToken = expandDecimals(1, 18)
    // pricer.update is invoked on latte transfers
    // sellTokens should be called twice since the transfer happens
    // before prices are updated in the uniswap pool
    await sellTokens({ router, wallet, weth, token: latte, amountToken })
    await sellTokens({ router, wallet, weth, token: latte, amountToken })

    expect(await pricer.cp0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.cp1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken })
    await sellTokens({ router, wallet, weth, token: latte, amountToken })

    expect(await pricer.cp0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.cp1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken })
    await sellTokens({ router, wallet, weth, token: latte, amountToken })

    expect(await pricer.cp0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.cp1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).gt(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(true)

    const amountIn = expandDecimals(1, 18)
    // use ranges to compare instead of eq because there will be slight variations in the
    // different block.timestamps used for calculations between runs
    // 2520000000000000000 is 2.52, which is close to 1000 / 400 = 2.5
    expectBetween(await pricer.tokensForEth(amountIn), "2520000000000000000", "2521000000000000000")
    // 396700000000000000 is 0.3967, which is close to 400 / 1000 = 0.4
    expectBetween(await pricer.ethForTokens(amountIn), "396800000000000000", "396900000000000000")

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken })
    await sellTokens({ router, wallet, weth, token: latte, amountToken })

    // 2530000000000000000 is 2.53, the tokens to be received should increase
    expectBetween(await pricer.tokensForEth(amountIn), "2530000000000000000", "2531000000000000000")
    // 395200000000000000 is 0.3952, the eth to be received should decrease
    expectBetween(await pricer.ethForTokens(amountIn), "395200000000000000", "395300000000000000")

    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(true)
  })

  it("resets hasIncreasingPrice if there are no recent trades", async () => {
    const amountETH = expandDecimals(1, 18)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    expect(await pricer.hasIncreasingPrice()).eq(true)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 20 * 60)
    await mineBlock(provider)

    expect(await pricer.hasStalePricing()).eq(false)
    expect(await pricer.hasIncreasingPrice()).eq(true)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 20 * 60)
    await mineBlock(provider)

    expect(await pricer.hasStalePricing()).eq(true)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)
  })
})
