const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, increaseTime } = require("./shared/utilities")
const { addLiquidityETH, sellTokens } = require("./shared/uniswap")
const { expectBetween } = require("./shared/waffle")

use(solidity)

describe("Shopper", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let router
  let shopper
  let pricer
  let pool

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    shopper = fixtures.shopper
    pricer = fixtures.pricer
    pool = fixtures.pool
  })

  it("inits cashier", async () => {
    expect(await shopper.cashier()).eq(wallet.address)
  })

  it("inits gov", async () => {
    expect(await shopper.gov()).eq(wallet.address)
  })

  it("sets cashier", async () => {
    await shopper.setCashier(user0.address)
    expect(await shopper.cashier()).eq(user0.address)
  })

  it("sets gov", async () => {
    await shopper.setGov(user0.address)
    expect(await shopper.gov()).eq(user0.address)
  })

  it("sets fee", async () => {
    await shopper.setFee("200")
    expect(await shopper.feeBasisPoints()).eq("200")
  })

  it("setCashier fails unless sender is gov", async () => {
    await shopper.setGov(user0.address)
    await expect(shopper.setCashier(user1.address))
      .to.be.revertedWith("Shopper: forbidden")

    expect(await shopper.cashier()).eq(wallet.address)

    await shopper.connect(user0).setCashier(user1.address)
    expect(await shopper.cashier()).eq(user1.address)
  })

  it("setGov fails unless sender is gov", async () => {
    await shopper.setGov(user0.address)
    await expect(shopper.setGov(user1.address))
      .to.be.revertedWith("Shopper: forbidden")

    expect(await shopper.gov()).eq(user0.address)

    await shopper.connect(user0).setGov(user1.address)
    expect(await shopper.gov()).eq(user1.address)
  })

  it("setFee fails unless sender is gov", async () => {
    await shopper.setGov(user0.address)
    await expect(shopper.setFee("300"))
      .to.be.revertedWith("Shopper: forbidden")

    expect(await shopper.feeBasisPoints()).eq("100")

    await shopper.connect(user0).setFee("300")
    expect(await shopper.feeBasisPoints()).eq("300")
  })

  it("setFee fails if fee exceeds allowed limit", async () => {
    await shopper.setFee("500")
    await expect(shopper.setFee("501"))
      .to.be.revertedWith("Shopper: fee exceeds allowed limit")
  })

  it("burn fails if tokensIn is zero", async () => {
    await expect(shopper.burn(0))
      .to.be.revertedWith("Shopper: insufficient value in")
  })

  it("burn fails unless price is decreasing", async () => {
    await expect(shopper.burn(100))
      .to.be.revertedWith("Shopper: not open for buying")
  })

  it("burns", async () => {
    const amountToken = expandDecimals(1000, 18)
    const amountETH = expandDecimals(400, 18)
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })

    const sellAmount = expandDecimals(1, 18)
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amountToken: sellAmount })

    const cashier = "0xa63c44249f0f7dd3b0571f7d96427a677a497f68"
    await shopper.setCashier(cashier)

    expect(await latte.totalSupply()).eq(expandDecimals(10000, 18))

    // 50 tokens allowed to be burnt, 0.5% of the total supply of 10000
    expect(await shopper.getMaxBurnableAmount()).eq("50000000000000000000")

    await expect(shopper.connect(user1).burn(expandDecimals(1, 18)))
      .to.be.revertedWith("Shopper: insufficient ETH to fulfill request")

    await wallet.sendTransaction({ to: shopper.address, value: expandDecimals(1, 18) })

    await expect(shopper.connect(user1).burn(expandDecimals(1, 18)))
      .to.be.revertedWith("Latte: burn amount exceeds balance")

    const tokensIn = expandDecimals(1, 18)
    await latte.transfer(user1.address, tokensIn)
    expect(await latte.balanceOf(user1.address)).eq(tokensIn)

    // 396700000000000000 is 0.3967, which is close to 400 / 1000 = 0.4
    const ethExpected = await pricer.ethForTokens(tokensIn)
    expectBetween(ethExpected, "396800000000000000", "396900000000000000")
    const userBalance1 = await provider.getBalance(user1.address)
    const tx = await shopper.connect(user1).burn(tokensIn)
    const receipt = await provider.getTransactionReceipt(tx.hash)
    const txFee = tx.gasPrice.mul(receipt.gasUsed)
    const ethReceived = (await provider.getBalance(user1.address)).sub(userBalance1).add(txFee)
    expect(ethReceived).eq(ethExpected)
    expect(await latte.balanceOf(user1.address)).eq("0")

    // 0.01 latte should be sent to the cashier
    const cashierBalance = await latte.balanceOf(cashier)
    expect(cashierBalance).eq("10000000000000000")

    const burnable = expandDecimals(50, 18).sub(tokensIn).add(cashierBalance)
    expect(await shopper.getMaxBurnableAmount()).eq(burnable)

    expect(await latte.totalSupply()).eq(expandDecimals(10000, 18).sub(tokensIn).add(cashierBalance))
  })
})
