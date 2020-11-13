const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, bigNumberify, increaseTime, mineBlock } = require("./shared/utilities")
const { getLatestSlot, expectLedger } = require("./shared/xvix")

use(solidity)

describe("Minter", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let xvix
  let weth
  let router
  let minter
  let floor

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    xvix = fixtures.xvix
    weth = fixtures.weth
    router = fixtures.router
    minter = fixtures.minter
    floor = fixtures.floor

    expect(await minter.ethReserve()).eq(expandDecimals(400, 18))
    expect(await minter.tokenReserve()).eq(expandDecimals(1000, 18))
  })

  it("getMintAmount", async() => {
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    // k: 400 * 1000
    // if amountIn is 1, amountOut should be ~2.4937, close to 2.5 (1000 / 400)
    const mintAmount0 = await minter.getMintAmount(expandDecimals(1, 18))
    expect(mintAmount0).eq("2493765586034912719")

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
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    // k: 400 * 1000
    // if amountIn is 1, amountOut should be ~2.4937, close to 2.5 (1000 / 400)
    const mintAmount0 = await minter.getMintAmount(expandDecimals(1, 18))
    expect(mintAmount0).eq("2493765586034912719")

    // the mint amount is capped to the mint amount of the floor - 5%
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(499, 18) })
    const mintAmount1 = await minter.getMintAmount(expandDecimals(1, 18))
    expect(mintAmount1).eq("1800000000000000000")
  })

  it("mint fails if value is zero", async () => {
    await expect(minter.mint(user0.address, { value: "0" }))
      .to.be.revertedWith("Minter: insufficient value")
  })

  it("mint", async () => {
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    expect(await xvix.balanceOf(user0.address)).eq("0")
    expect(await xvix.balanceOf(user1.address)).eq("0")
    expect(await provider.getBalance(floor.address)).eq(expandDecimals(1, 18))
    expect(await floor.capital()).eq(expandDecimals(1, 18))
    await expectLedger(xvix, user0.address, 0, 0, 0, 0)
    await expectLedger(xvix, user1.address, 0, 0, 0, 0)

    await minter.connect(user0).mint(user1.address, { value: expandDecimals(1, 18) })
    const minted = "2493765586034912719"
    const remaining = "997506234413965087281"
    expect(await xvix.balanceOf(user0.address)).eq("0")
    expect(await xvix.balanceOf(user1.address)).eq(minted)
    expect(await provider.getBalance(floor.address)).eq(expandDecimals(2, 18))
    expect(await floor.capital()).eq(expandDecimals(2, 18))

    const slot = await getLatestSlot(provider)
    await expectLedger(xvix, user0.address, 0, 0, 0, 0)
    await expectLedger(xvix, user1.address, 0, 0, slot, minted)

    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18).add(minted))

    expect(await minter.ethReserve()).eq(expandDecimals(401, 18))
    expect(await minter.tokenReserve()).eq(remaining)
    expect(bigNumberify(remaining).add(minted)).eq(expandDecimals(1000, 18))
    const k = (await minter.ethReserve()).mul(await minter.tokenReserve())
    expect(k).eq("399999999999999999999681000000000000000000")
  })

  it("caps mint", async () => {
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(1, 18) })

    expect(await xvix.balanceOf(user0.address)).eq("0")
    expect(await xvix.balanceOf(user1.address)).eq("0")
    expect(await provider.getBalance(floor.address)).eq(expandDecimals(1, 18))
    await wallet.sendTransaction({ to: floor.address, value: expandDecimals(499, 18) })

    await minter.connect(user0).mint(user1.address, { value: expandDecimals(1, 18) })
    const minted = "1800000000000000000"
    const remaining = "998200000000000000000"
    expect(await xvix.balanceOf(user0.address)).eq("0")
    expect(await xvix.balanceOf(user1.address)).eq(minted)
    expect(await provider.getBalance(floor.address)).eq(expandDecimals(501, 18))
    expect(await floor.capital()).eq(expandDecimals(501, 18))

    expect(await xvix.totalSupply()).eq(expandDecimals(1000, 18).add(minted))

    expect(await minter.ethReserve()).eq(expandDecimals(401, 18))
    expect(await minter.tokenReserve()).eq(remaining)
    expect(bigNumberify(remaining).add(minted)).eq(expandDecimals(1000, 18))
    const k = (await minter.ethReserve()).mul(await minter.tokenReserve())
    expect(k).eq("400278200000000000000000000000000000000000")

    expect(await xvix.getBurnAllowance(user1.address)).eq("0")

    increaseTime(provider, 8 * 24 * 60 * 60)
    mineBlock(provider)

    expect(await xvix.getBurnAllowance(user1.address)).eq("54000000000000000")
  })
})
