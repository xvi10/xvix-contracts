const { deployContract } = require("ethereum-waffle")
const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock } = require("./shared/utilities")
const { addLiquidityETH, buyTokens, sellTokens } = require("./shared/uniswap")

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

    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })

    pricer = await deployContract(wallet, Pricer, [pair.address, latte.address])
    await latte.setPricer(pricer.address)
  })

  it("sets use0", async () => {
    const token0 = await pair.token0()
    const shouldUse0 = token0 == latte.address
    expect(await pricer.use0()).eq(shouldUse0)
  })

  it("updates when price is increasing", async () => {
    expect(await pricer.p0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.p1()).eq(0)
    expect(await pricer.t1()).eq(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    const amountETH = expandDecimals(1, 18)
    // pricer.update is invoked on latte transfers
    // buyTokens should be called twice since the transfer happens
    // before prices are updated in the uniswap pool
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    expect(await pricer.p0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.p1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    expect(await pricer.p0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.p1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    expect(await pricer.p0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.p1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).gt(0)
    expect(await pricer.hasIncreasingPrice()).eq(true)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    const amountIn = expandDecimals(1, 18)
    // use ranges to compare instead of eq because there will be slight variations in the
    // different block.timestamps used for calculations between runs
    // 2450000000000000000 is 2.45, which is close to 1000 / 400 = 2.5
    expect(await pricer.tokensForEth(amountIn)).gt("2450000000000000000")
    expect(await pricer.tokensForEth(amountIn)).lt("2451000000000000000")
    // 408000000000000000 is 0.408, which is close to 400 / 1000 = 0.4
    expect(await pricer.ethForTokens(amountIn)).gt("408000000000000000")
    expect(await pricer.ethForTokens(amountIn)).lt("408100000000000000")

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amountETH })
    await buyTokens({ router, wallet, weth, token: latte, amountETH })

    // 2426000000000000000 is 2.426, the tokens to be received should decrease
    expect(await pricer.tokensForEth(amountIn)).gt("2426000000000000000")
    expect(await pricer.tokensForEth(amountIn)).lt("2427000000000000000")
    // 412000000000000000 is 0.412, the eth to be received should increase
    expect(await pricer.ethForTokens(amountIn)).gt("412000000000000000")
    expect(await pricer.ethForTokens(amountIn)).lt("412100000000000000")

    expect(await pricer.hasIncreasingPrice()).eq(true)
    expect(await pricer.hasDecreasingPrice()).eq(false)
  })

  it("updates when price is decreasing", async () => {
    expect(await pricer.p0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.p1()).eq(0)
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

    expect(await pricer.p0()).eq(0)
    expect(await pricer.t0()).eq(0)
    expect(await pricer.p1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken })
    await sellTokens({ router, wallet, weth, token: latte, amountToken })

    expect(await pricer.p0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.p1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).eq(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken })
    await sellTokens({ router, wallet, weth, token: latte, amountToken })

    expect(await pricer.p0()).gt(0)
    expect(await pricer.t0()).gt(0)
    expect(await pricer.p1()).gt(0)
    expect(await pricer.t1()).gt(0)
    expect(await pricer.lastPrice()).gt(0)
    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(true)

    const amountIn = expandDecimals(1, 18)
    // use ranges to compare instead of eq because there will be slight variations in the
    // different block.timestamps used for calculations between runs
    // 2520000000000000000 is 2.52, which is close to 1000 / 400 = 2.5
    expect(await pricer.tokensForEth(amountIn)).gt("2520000000000000000")
    expect(await pricer.tokensForEth(amountIn)).lt("2521000000000000000")
    // 396700000000000000 is 0.3967, which is close to 400 / 1000 = 0.4
    expect(await pricer.ethForTokens(amountIn)).gt("396800000000000000")
    expect(await pricer.ethForTokens(amountIn)).lt("396900000000000000")

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken })
    await sellTokens({ router, wallet, weth, token: latte, amountToken })

    // 2530000000000000000 is 2.53, the tokens to be received should increase
    expect(await pricer.tokensForEth(amountIn)).gt("2530000000000000000")
    expect(await pricer.tokensForEth(amountIn)).lt("2531000000000000000")
    // 395200000000000000 is 0.3952, the eth to be received should decrease
    expect(await pricer.ethForTokens(amountIn)).gt("395200000000000000")
    expect(await pricer.ethForTokens(amountIn)).lt("395300000000000000")

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

    expect(await pricer.hasIncreasingPrice()).eq(true)
    expect(await pricer.hasDecreasingPrice()).eq(false)

    await increaseTime(provider, 20 * 60)
    await mineBlock(provider)

    expect(await pricer.hasIncreasingPrice()).eq(false)
    expect(await pricer.hasDecreasingPrice()).eq(false)
  })
})
