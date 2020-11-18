const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract, contractAt } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock, getBlockTime } = require("./shared/utilities")
const { getRebaseTime } = require("./shared/xvix")
const { addLiquidityETH } = require("./shared/uniswap")

use(solidity)

describe("Distributor", function() {
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let distributor
  let lgeTokenWETH
  let lgeTokenDAI
  let xvix
  let weth
  let dai
  let floor
  let minter
  let router
  let factory
  let pairs
  let lgeEndTime
  let lpUnlockTime

  beforeEach(async () => {
    distributor = await deployContract("Distributor", [])

    const fixtures = await loadFixtures(provider, wallet, distributor)
    xvix = fixtures.xvix
    weth = fixtures.weth
    dai = fixtures.dai
    floor = fixtures.floor
    minter = fixtures.minter
    router = fixtures.router
    factory = fixtures.factory
    pairs = fixtures.pairs

    lgeTokenWETH = await deployContract("LGEToken", ["XLGE WETH LP", "XLGE:WETH", distributor.address, weth.address])
    lgeTokenDAI = await deployContract("LGEToken", ["XLGE DAI LP", "XLGE:DAI", distributor.address, dai.address])

    const blockTime = await getBlockTime(provider)
    lgeEndTime = blockTime + 14 * 24 * 60 * 60
    lpUnlockTime = blockTime + 42 * 24 * 60 * 60

    await distributor.initialize([
      xvix.address,
      weth.address,
      dai.address,
      lgeTokenWETH.address,
      lgeTokenDAI.address,
      floor.address,
      minter.address,
      router.address,
      factory.address],
      lgeEndTime,
      lpUnlockTime
    )
  })

  it("inits", async () => {
    expect(await distributor.gov()).eq(wallet.address)
    expect(await distributor.isInitialized()).eq(true)
    expect(await distributor.xvix()).eq(xvix.address)
    expect(await distributor.weth()).eq(weth.address)
    expect(await distributor.dai()).eq(dai.address)
    expect(await distributor.lgeTokenWETH()).eq(lgeTokenWETH.address)
    expect(await distributor.lgeTokenDAI()).eq(lgeTokenDAI.address)
    expect(await distributor.floor()).eq(floor.address)
    expect(await distributor.minter()).eq(minter.address)
    expect(await distributor.router()).eq(router.address)
    expect(await distributor.factory()).eq(factory.address)
    expect(await lgeTokenWETH.token()).eq(weth.address)
    expect(await lgeTokenDAI.token()).eq(dai.address)

    // expect(await distributor.path()).eq([weth.address, dai.address])
    expect(await distributor.lgeEndTime()).eq(lgeEndTime)
    expect(await distributor.lpUnlockTime()).eq(lpUnlockTime)
  })

  it("initialize", async () => {
    await expect(distributor.connect(user0).initialize([], 1, 1))
      .to.be.revertedWith("Distributor: forbidden")
    await expect(distributor.initialize([], 1, 1))
      .to.be.revertedWith("Distributor: already initialized")
  })

  it("join", async () => {
    const blockTime = await getBlockTime(provider)
    await dai.mint(wallet.address, expandDecimals(90000, 18))
    await addLiquidityETH({ router, wallet, token: dai,
      tokenAmount: expandDecimals(90000, 18), ethAmount: expandDecimals(20, 18) })
    await expect(distributor.join(user1.address, 1, 1, { value: 0 }))
      .to.be.revertedWith("Distributor: insufficient value")

    expect(await provider.getBalance(distributor.address)).eq("0")
    expect(await dai.balanceOf(distributor.address)).eq("0")
    await distributor.connect(user0).join(user1.address, expandDecimals(10, 18), blockTime + 60, { value: expandDecimals(1, 18) })
    expect(await provider.getBalance(floor.address)).eq("500000000000000000") // 0.5 ETH
    expect(await provider.getBalance(distributor.address)).eq("250000000000000000") // 0.25 ETH
    expect(await dai.balanceOf(distributor.address)).eq("1107818808104003851994") // ~1107 DAI, ~4500 * 0.25

    expect(await lgeTokenWETH.balanceOf(user1.address)).eq(expandDecimals(1, 18))
    expect(await lgeTokenDAI.balanceOf(user1.address)).eq(expandDecimals(1, 18))
  })

  it("join fails if LGE has ended", async () => {
    await xvix.createSafe(distributor.address)
    await xvix.transfer(distributor.address, expandDecimals(100, 18))

    await dai.mint(wallet.address, expandDecimals(90000, 18))
    await addLiquidityETH({ router, wallet, token: dai,
      tokenAmount: expandDecimals(90000, 18), ethAmount: expandDecimals(20, 18) })

    const blockTime = await getBlockTime(provider)
    await distributor.join(user1.address, expandDecimals(10, 18), blockTime + 60, { value: expandDecimals(1, 18) })
    await distributor.endLGE(blockTime + 60)
    await expect(distributor.join(user1.address, 1, 1, { value: 0 }))
      .to.be.revertedWith("Distributor: LGE has ended")
  })

  it("endLGE", async () => {

  })
})
