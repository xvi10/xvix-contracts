const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures } = require("./shared/fixtures")
const { expandDecimals, bigNumberify } = require("./shared/utilities")

use(solidity)

describe("Cafe", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let latte
  let weth
  let router
  let cafe
  let pool

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet)
    latte = fixtures.latte
    weth = fixtures.weth
    router = fixtures.router
    cafe = fixtures.cafe
    pool = fixtures.pool

    expect(await cafe.ethReserve()).eq(expandDecimals(400, 18))
    expect(await cafe.tokenReserve()).eq(expandDecimals(1000, 18))
  })

  it("getMintAmount", async() => {
    // k: 400 * 1000
    // if amountIn is 1, amountOut should be ~2.4937, close to 2.5 (1000 / 400)
    const mintAmount0 = await cafe.getMintAmount(expandDecimals(1, 18))
    expect(mintAmount0).eq("2493765586034912719")

    // if amountIn is 100, amountOut should be 200
    // (400 + 100) * (1000 - 200) = 500 * 800 = k
    const mintAmount1 = await cafe.getMintAmount(expandDecimals(100, 18))
    expect(mintAmount1).eq(expandDecimals(200, 18))

    // if amountIn is 400, amountOut should be 500
    // (400 + 400) * (1000 - 500) = 800 * 500 = k
    const mintAmount2 = await cafe.getMintAmount(expandDecimals(400, 18))
    expect(mintAmount2).eq(expandDecimals(500, 18))
  })

  it("increaseTokenReserve fails unless sender is latte", async () => {
    await expect(cafe.increaseTokenReserve("1"))
      .to.be.revertedWith("Cafe: forbidden")
  })

  it("mint fails if value is zero", async () => {
    await expect(cafe.mint(user0.address, { value: "0" }))
      .to.be.revertedWith("Cafe: insufficient value in")
  })

  it("mint", async () => {
    expect(await latte.balanceOf(user0.address)).eq("0")
    expect(await latte.balanceOf(user1.address)).eq("0")
    expect(await provider.getBalance(pool.address)).eq("0")
    expect(await pool.capital()).eq("0")

    await cafe.connect(user0).mint(user1.address, { value: expandDecimals(1, 18) })
    const minted = "2493765586034912719"
    const remaining = "997506234413965087281"
    expect(await latte.balanceOf(user0.address)).eq("0")
    expect(await latte.balanceOf(user1.address)).eq(minted)
    expect(await provider.getBalance(pool.address)).eq(expandDecimals(1, 18))
    expect(await pool.capital()).eq(expandDecimals(1, 18))

    expect(await latte.totalSupply()).eq(expandDecimals(1000, 18).add(minted))

    expect(await cafe.ethReserve()).eq(expandDecimals(401, 18))
    expect(await cafe.tokenReserve()).eq(remaining)
    expect(bigNumberify(remaining).add(minted)).eq(expandDecimals(1000, 18))
    const k = (await cafe.ethReserve()).mul(await cafe.tokenReserve())
    expect(k).eq("399999999999999999999681000000000000000000")
  })
})
