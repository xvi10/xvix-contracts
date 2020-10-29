const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock, getBlockTime } = require("./shared/utilities")
const { addLiquidityETH, removeLiquidityETH } = require("./shared/uniswap")

use(solidity)

describe("Timelock", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let pair
  let timelock
  let releaseTime
  let market

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    pair = fixtures.pair
    market = fixtures.market

    const blockTime = await getBlockTime(provider)
    releaseTime = blockTime + 600
    timelock = await deployContract("Timelock", [pair.address, user0.address, releaseTime])
  })

  it("inits", async () => {
    expect(await timelock.token()).eq(pair.address)
    expect(await timelock.receiver()).eq(user0.address)
    expect(await timelock.releaseTime()).eq(releaseTime)
    expect(await timelock.gov()).eq(wallet.address)
  })

  it("setGov", async () => {
    await expect(timelock.connect(user0).setGov(user1.address))
      .to.be.revertedWith("Timelock: forbidden")

    await timelock.setGov(user0.address)
    expect(await timelock.gov()).eq(user0.address)

    await timelock.connect(user0).setGov(user1.address)
    expect(await timelock.gov()).eq(user1.address)
  })

  it("setReceiver", async () => {
    await expect(timelock.connect(user0).setReceiver(user1.address))
      .to.be.revertedWith("Timelock: forbidden")
    expect(await timelock.receiver()).eq(user0.address)

    await timelock.setGov(user0.address)
    await timelock.connect(user0).setReceiver(user1.address)
    expect(await timelock.receiver()).eq(user1.address)
  })

  it("release fails if sender is not gov", async () => {
    await expect(timelock.connect(user0).release("1"))
      .to.be.revertedWith("Timelock: forbidden")
  })

  it("release fails if release time is not yet reached", async () => {
    await timelock.setGov(user0.address)
    await expect(timelock.connect(user0).release("1"))
      .to.be.revertedWith("Timelock: release time not yet reached")
  })

  it("release", async () => {
    expect(await pair.balanceOf(wallet.address)).eq("0")

    const tokenAmount = expandDecimals(1000, 18)
    const ethAmount = expandDecimals(400, 18)
    await addLiquidityETH({ router: market, wallet, token: latte, tokenAmount, ethAmount })
    expect(await pair.balanceOf(wallet.address)).eq("632455532033675865399")

    pair.transfer(timelock.address, "632455532033675865399")
    expect(await pair.balanceOf(wallet.address)).eq("0")
    expect(await pair.balanceOf(timelock.address)).eq("632455532033675865399")

    await expect(timelock.release("632455532033675865390"))
      .to.be.revertedWith("Timelock: release time not yet reached")

    await increaseTime(provider, 1000)
    await mineBlock(provider)

    expect(await pair.balanceOf(user0.address)).eq("0")
    await timelock.release("632455532033675865390")
    expect(await pair.balanceOf(user0.address)).eq("632455532033675865390")
    expect(await pair.balanceOf(timelock.address)).eq("9")
  })
})
