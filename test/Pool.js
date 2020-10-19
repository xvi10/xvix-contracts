const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime, bigNumberify } = require("./shared/utilities")
const { addLiquidityETH, sellTokens, buyTokens } = require("./shared/uniswap")
const { expectBetween } = require("./shared/waffle")
const { increasePrice, decreasePrice } = require("./shared/pricer")

use(solidity)

describe("Pool", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let router
  let shopper
  let pricer
  let market
  let pool

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    shopper = fixtures.shopper
    pricer = fixtures.pricer
    market = fixtures.market
    pool = fixtures.pool
  })

  it("inits latestSlot", async () => {
    expect(await pool.latestSlot()).gt(0)
  })

  it("inits market", async () => {
    expect(await pool.market()).eq(market.address)
  })

  it("setMarket fails if sender is not gov", async () => {
    await expect(pool.connect(user0).setMarket("0x2f063ac4a33b76273c6e308a6c57a8f7876cd5e6"))
      .to.be.revertedWith("Pool: forbidden")
  })

  it("setMarket fails if market was already initialised", async () => {
    await expect(pool.setMarket("0x2f063ac4a33b76273c6e308a6c57a8f7876cd5e6"))
      .to.be.revertedWith("Pool: market already set")
  })

  it("updates capital", async () => {
    const amount = expandDecimals(2, 18)
    expect(await pool.capital()).eq("0")
    await pool.fund({ value: amount })
    expect(await pool.capital()).eq(amount)
  })

  it("mint fails if sender is not market", async () => {
    await expect(pool.mint(user0.address, "1"))
      .to.be.revertedWith("Pool: forbidden")
  })

  it("mints", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const sellAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await decreasePrice({ provider, router, wallet, latte, weth, sellAmount })

    const slot = await pool.latestSlot()

    // user0 buys
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")

    const buyAmount0 = expandDecimals(1, 18)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })
    expect(await pool.latestSlot()).eq(slot)

    const shares0 = await latte.balanceOf(user0.address)
    // 2.516, slightly less than the shopper's price of ~2.52 because of slippage
    expectBetween(shares0, "2516000000000000000", "2517000000000000000")
    expect(await pool.shares(slot, user0.address)).eq(shares0)
    expect(await pool.totalShares(slot)).eq(shares0)

    // user1 buys
    expect(await pool.shares(slot, user1.address)).eq("0")
    expect(await latte.balanceOf(user1.address)).eq("0")

    const buyAmount1 = expandDecimals(3, 18)
    await buyTokens({ router: market, wallet: user1, weth, token: latte, amount: buyAmount1 })
    expect(await pool.latestSlot()).eq(slot)

    const shares1 = await latte.balanceOf(user1.address)
    expectBetween(shares1, "7473000000000000000", "7474000000000000000")
    expect(await pool.shares(slot, user1.address)).eq(shares1)

    const totalShares = shares0.add(shares1)
    expect(await pool.totalShares(slot)).eq(totalShares)

    await pool.fund({ value: expandDecimals(20, 18) })
    // increase time by 24 hours and 1 minute
    await increaseTime(provider, 24 * 60 * 60 + 60)

    const userBalance0 = await provider.getBalance(user0.address)
    const tx0 = await pool.connect(user0).claim()
    const receipt0 = await provider.getTransactionReceipt(tx0.hash)
    const txFee0 = tx0.gasPrice.mul(receipt0.gasUsed)
    const ethReceived0 = (await provider.getBalance(user0.address)).sub(userBalance0).add(txFee0)

    // expect rewards to be 20 * 0.02 = 0.4 ETH, there is a bonus since this is the first distribution
    const reward = bigNumberify("400000000000000000")
    expect(await pool.rewards(slot)).eq(reward)
    expect(await pool.distributedCapital()).eq(reward)
    expect(ethReceived0).eq(reward.mul(shares0).div(totalShares))
    expect(await pool.latestSlot()).gt(slot)

    const userBalance1 = await provider.getBalance(user1.address)
    const tx1 = await pool.connect(user1).claim()
    const receipt1 = await provider.getTransactionReceipt(tx1.hash)
    const txFee1 = tx1.gasPrice.mul(receipt1.gasUsed)
    const ethReceived1 = (await provider.getBalance(user1.address)).sub(userBalance1).add(txFee1)
    expect(ethReceived1).eq(reward.mul(shares1).div(totalShares))
  })

  it("mints with pool.swapETHForExactTokens", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const sellAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await decreasePrice({ provider, router, wallet, latte, weth, sellAmount })

    const slot = await pool.latestSlot()

    // user0 buys
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")

    const buyAmount0 = "2516000000000000000"
    await market.connect(user0).swapETHForExactTokens(
      buyAmount0,
      [weth.address, latte.address],
      user0.address,
      ethers.constants.MaxUint256,
      { value: expandDecimals(2, 18) }
    )
    expect(await pool.latestSlot()).eq(slot)
    const shares0 = await latte.balanceOf(user0.address)
    expect(shares0).eq(buyAmount0)
    expect(await pool.shares(slot, user0.address)).eq(buyAmount0)
    expect(await pool.totalShares(slot)).eq(buyAmount0)
  })

  it("does not mint if price is not decreasing", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const buyAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await increasePrice({ provider, router, wallet, latte, weth, buyAmount })

    expect(await pricer.hasDecreasingPrice()).eq(false)

    const slot = await pool.latestSlot()
    const buyAmount0 = expandDecimals(1, 18)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })
    expect(await pool.latestSlot()).eq(slot)
    expectBetween(await latte.balanceOf(user0.address), "2413000000000000000", "2414000000000000000")
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await pool.totalShares(slot)).eq("0")

    await pool.fund({ value: expandDecimals(20, 18) })
    // increase time by 24 hours and 1 minute
    await increaseTime(provider, 24 * 60 * 60 + 60)

    const userBalance0 = await provider.getBalance(user0.address)
    const tx0 = await pool.connect(user0).claim()
    const receipt0 = await provider.getTransactionReceipt(tx0.hash)
    const txFee0 = tx0.gasPrice.mul(receipt0.gasUsed)
    const ethReceived0 = (await provider.getBalance(user0.address)).sub(userBalance0).add(txFee0)

    expect(await pool.rewards(slot)).eq("0")
    expect(await pool.distributedCapital()).eq("0")
    expect(ethReceived0).eq("0")
  })

  it("burns", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const sellAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await decreasePrice({ provider, router, wallet, latte, weth, sellAmount })

    const slot = await pool.latestSlot()

    // user0 buys
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")

    const buyAmount0 = expandDecimals(1, 18)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })
    expect(await pool.latestSlot()).eq(slot)

    const shares0 = await latte.balanceOf(user0.address)
    // 2.516, slightly less than the shopper's price of ~2.52 because of slippage
    expectBetween(shares0, "2516000000000000000", "2517000000000000000")
    expect(await pool.shares(slot, user0.address)).eq(shares0)
    expect(await pool.totalShares(slot)).eq(shares0)

    // user1 buys
    expect(await pool.shares(slot, user1.address)).eq("0")
    expect(await latte.balanceOf(user1.address)).eq("0")

    const buyAmount1 = expandDecimals(3, 18)
    await buyTokens({ router: market, wallet: user1, weth, token: latte, amount: buyAmount1 })
    expect(await pool.latestSlot()).eq(slot)

    const shares1 = await latte.balanceOf(user1.address)
    expectBetween(shares1, "7473000000000000000", "7474000000000000000")
    expect(await pool.shares(slot, user1.address)).eq(shares1)

    await latte.connect(user0).transfer(user1.address, "10")
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await pool.totalShares(slot)).eq(shares1)
  })

  it("does not reduce totalShares if interval has passed", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const sellAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await decreasePrice({ provider, router, wallet, latte, weth, sellAmount })

    const slot = await pool.latestSlot()

    // user0 buys
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")

    const buyAmount0 = expandDecimals(1, 18)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })
    expect(await pool.latestSlot()).eq(slot)

    const shares0 = await latte.balanceOf(user0.address)
    // 2.516, slightly less than the shopper's price of ~2.52 because of slippage
    expectBetween(shares0, "2516000000000000000", "2517000000000000000")
    expect(await pool.shares(slot, user0.address)).eq(shares0)
    expect(await pool.totalShares(slot)).eq(shares0)

    // user1 buys
    expect(await pool.shares(slot, user1.address)).eq("0")
    expect(await latte.balanceOf(user1.address)).eq("0")

    const buyAmount1 = expandDecimals(3, 18)
    await buyTokens({ router: market, wallet: user1, weth, token: latte, amount: buyAmount1 })
    expect(await pool.latestSlot()).eq(slot)

    const shares1 = await latte.balanceOf(user1.address)
    expectBetween(shares1, "7473000000000000000", "7474000000000000000")
    expect(await pool.shares(slot, user1.address)).eq(shares1)

    // increase time by 24 hours and 1 minute
    await increaseTime(provider, 24 * 60 * 60 + 60)

    await latte.connect(user0).transfer(user1.address, "10")
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await pool.totalShares(slot)).eq(shares0.add(shares1))
  })

  it("rolls over shares", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const sellAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await decreasePrice({ provider, router, wallet, latte, weth, sellAmount })

    const slot = await pool.latestSlot()

    // user0 buys
    expect(await pool.shares(slot, user0.address)).eq("0")
    expect(await latte.balanceOf(user0.address)).eq("0")

    const buyAmount0 = expandDecimals(1, 18)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })
    expect(await pool.latestSlot()).eq(slot)
    expect(await pool.slots(user0.address)).eq(slot)

    const shares0 = await latte.balanceOf(user0.address)
    // 2.516, slightly less than the shopper's price of ~2.52 because of slippage
    expectBetween(shares0, "2516000000000000000", "2517000000000000000")
    expect(await pool.shares(slot, user0.address)).eq(shares0)
    expect(await pool.totalShares(slot)).eq(shares0)

    // user1 buys
    expect(await pool.shares(slot, user1.address)).eq("0")
    expect(await latte.balanceOf(user1.address)).eq("0")

    const buyAmount1 = expandDecimals(3, 18)
    await buyTokens({ router: market, wallet: user1, weth, token: latte, amount: buyAmount1 })
    expect(await pool.latestSlot()).eq(slot)

    const shares1 = await latte.balanceOf(user1.address)
    expectBetween(shares1, "7473000000000000000", "7474000000000000000")
    expect(await pool.shares(slot, user1.address)).eq(shares1)

    // increase time by 24 hours and 1 minute
    await increaseTime(provider, 24 * 60 * 60 + 60)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })

    const totalBought = await latte.balanceOf(user0.address)
    const newlyBought = totalBought.sub(shares0)
    const nextSlot = await pool.latestSlot()
    expectBetween(newlyBought, "2466000000000000000", "2467000000000000000")

    expect(await pool.slots(user0.address)).eq(nextSlot)
    expect(await pool.shares(nextSlot, user0.address)).eq(shares0.mul(5000).div(10000).add(newlyBought))
  })

  it("does not give bonus reward unless price is increasing", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    const buyAmount = expandDecimals(1, 18)
    const sellAmount = expandDecimals(1, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })
    await increasePrice({ provider, router, wallet, latte, weth, buyAmount })
    // increase time by 24 hours and 1 minute
    await increaseTime(provider, 24 * 60 * 60 + 60)
    await pool.moveToNextSlot()

    const slot = await pool.latestSlot()
    expect(await pool.prices(slot)).gt("0")

    await decreasePrice({ provider, router, wallet, latte, weth, sellAmount })

    const buyAmount0 = expandDecimals(1, 18)
    await buyTokens({ router: market, wallet: user0, weth, token: latte, amount: buyAmount0 })

    await pool.fund({ value: expandDecimals(20, 18) })
    await decreasePrice({ provider, router, wallet, latte, weth, sellAmount })

    await increaseTime(provider, 24 * 60 * 60 + 60)
    await pool.moveToNextSlot()

    const reward = bigNumberify("200000000000000000")
    expect(await pool.rewards(slot)).eq(reward)
  })
})
