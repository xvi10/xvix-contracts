const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, bigNumberify, increaseTime, mineBlock } = require("./shared/utilities")
const { getRebaseTime } = require("./shared/xvix")

use(solidity)

describe("Minter", function() {
  const provider = waffle.provider
  const [wallet, user0, user1, user2] = provider.getWallets()
  const distributor = user2
  let xvix
  let weth
  let router
  let minter
  let floor

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    weth = fixtures.weth
    router = fixtures.router
    minter = fixtures.minter
    floor = fixtures.floor
  })

  it("inits xvix", async () => {
    expect(await minter.xvix()).eq(xvix.address)
  })

  it("inits floor", async () => {
    expect(await minter.floor()).eq(floor.address)
  })

  it("inits distributor", async () => {
    expect(await minter.distributor()).eq(distributor.address)
  })

  it("enableMint", async () => {
    await expect(minter.enableMint(0))
      .to.be.revertedWith("Minter: forbidden")

    await expect(minter.connect(user2).enableMint(0))
      .to.be.revertedWith("Minter: insufficient eth reserve")

    expect(await minter.ethReserve()).eq(0)
    await minter.connect(user2).enableMint(10)

    await expect(minter.connect(user2).enableMint(5))
      .to.be.revertedWith("Minter: already active")

    expect(await minter.active()).eq(true)
    expect(await minter.ethReserve()).eq(10)
  })

  it("getMintAmount", async () => {
    await minter.connect(user2).enableMint(expandDecimals(400, 18))

    expect(await minter.getMintAmount(expandDecimals(100, 18))).eq(0)
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    // k: 400 * 1000
    // if amountIn is 1, amountOut should be ~2.4937, close to 2.5 (1000 / 400)
    const mintAmount0 = await minter.getMintAmount(expandDecimals(1, 18))
    expect(mintAmount0).eq("2493765586034912718")

    // if amountIn is 100, amountOut should be 200
    // (400 + 100) * (1000 - 200) = 500 * 800 = k
    const mintAmount1 = await minter.getMintAmount(expandDecimals(100, 18))
    expect(mintAmount1).eq(expandDecimals(200, 18))

    // if amountIn is 400, amountOut should be 500
    // (400 + 400) * (1000 - 500) = 800 * 500 = k
    const mintAmount2 = await minter.getMintAmount(expandDecimals(400, 18))
    expect(mintAmount2).eq(expandDecimals(500, 18))
  })

  it("getMintAmount is capped", async() => {
    await minter.connect(user2).enableMint(expandDecimals(400, 18))
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    // k: 400 * 1000
    // if amountIn is 1, amountOut should be ~2.4937, close to 2.5 (1000 / 400)
    const mintAmount0 = await minter.getMintAmount(expandDecimals(1, 18))
    expect(mintAmount0).eq("2493765586034912718")

    // the mint amount is capped to the mint amount of the floor
    // the floor has 500 ETH and there is a totalSupply of 1000 XVIX
    // so for 1 ETH, only 2 XVIX can be minted instead of ~2.4937 XVIX
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(499, 18) })
    const mintAmount1 = await minter.getMintAmount(expandDecimals(1, 18))
    expect(mintAmount1).eq(expandDecimals(2, 18))
  })

  it("tokenReserve", async () => {
    expect(await minter.tokenReserve()).eq(expandDecimals(1000, 18))
    await minter.connect(user2).enableMint(expandDecimals(400, 18))
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    // tokenReserve should increase with burns
    await floor.refund(wallet.address, expandDecimals(200, 18))
    expect(await minter.tokenReserve()).eq(expandDecimals(1200, 18))

    await xvix.transfer(user2.address, expandDecimals(100, 18))
    expect(await minter.tokenReserve()).eq("1200930000000000000000") // 1200 + 0.93
    expect(await xvix.totalSupply()).eq("799070000000000000000") // 799.07, 1000 - 200 - 0.93
    expect(await xvix.maxSupply()).eq(expandDecimals(2000, 18))
    expect(await xvix.balanceOf(user2.address)).eq(expandDecimals(99, 18))

    await xvix.connect(user2).toast(expandDecimals(70, 18))
    expect(await minter.tokenReserve()).eq("1200930000000000000000") // should not change
    expect(await xvix.totalSupply()).eq("729070000000000000000") // 729.07, 1000 - 200 - 0.93 - 70
    expect(await xvix.maxSupply()).eq(expandDecimals(1930, 18))
    expect(await xvix.balanceOf(user2.address)).eq(expandDecimals(29, 18))
  })

  it("mint", async () => {
    await expect(minter.mint(user1.address, { value: 0 }))
      .to.be.revertedWith("Minter: not active")

    await minter.connect(user2).enableMint(expandDecimals(400, 18))

    await expect(minter.mint(user1.address, { value: 0 }))
      .to.be.revertedWith("Minter: insufficient value")

    await expect(minter.mint(user1.address, { value: 1 }))
      .to.be.revertedWith("Minter: mint amount is zero")

    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    expect(await minter.getMintAmount(1)).eq(2)

    expect(await xvix.balanceOf(user1.address)).eq(0)
    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))
    await minter.mint(user1.address, { value: 1 })

    expect(await xvix.balanceOf(user1.address)).eq(2)
    expect(await xvix.totalSupply()).eq("1000000000000000000002")

    await xvix.createSafe(wallet.address)

    await increaseTime(provider, await getRebaseTime(provider, xvix, 3))
    await mineBlock(provider)

    await xvix.rebase()
    expect(await xvix.normalDivisor()).eq("100060012") // 100000000 * 100.02 ^ 3
    expect(await xvix.totalSupply()).eq("1000000000000000000001")
    expect(await minter.tokenReserve()).eq("999999999999999999999")
    expect(await xvix.balanceOf(user1.address)).eq(1)

    await minter.mint(user1.address, { value: 1 })
    expect(await xvix.totalSupply()).eq("1000000000000000000003")
    expect(await minter.tokenReserve()).eq("999999999999999999997")
    expect(await xvix.balanceOf(user1.address)).eq(3)
  })

  it("mint is cumulative", async () => {
    await minter.connect(user2).enableMint(expandDecimals(400, 18))
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    const ethAmount = expandDecimals(100, 18)
    expect(await xvix.balanceOf(user1.address)).eq(0)
    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18))
    expect(await minter.tokenReserve()).eq(expandDecimals(1000, 18))
    expect(await minter.ethReserve()).eq(expandDecimals(400, 18))

    // if amountIn is 100, amountOut should be 200
    // (400 + 100) * (1000 - 200) = 500 * 800 = k
    await minter.mint(user1.address, { value: ethAmount })
    expect(await xvix.balanceOf(user1.address)).eq(expandDecimals(200, 18))
    expect(await xvix.totalSupply()).eq(expandDecimals(1200, 18))
    expect(await minter.tokenReserve()).eq(expandDecimals(800, 18))
    expect(await minter.ethReserve()).eq(expandDecimals(500, 18))

    // if amountIn is 100, amountOut should be 133.333...
    // (500 + 100) * (800 - 133.333...) = 400,000
    await minter.mint(user1.address, { value: ethAmount })
    expect(await xvix.balanceOf(user1.address)).eq("333333333333333333333")
    expect(await xvix.totalSupply()).eq("1333333333333333333333")
    expect(await minter.tokenReserve()).eq("666666666666666666667")
    expect(await minter.ethReserve()).eq(expandDecimals(600, 18))
  })
})
