const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { expandDecimals, increaseTime, mineBlock, getBlockTime } = require("./shared/utilities")
const { getRebaseTime } = require("./shared/xvix")
const { addLiquidityETH, buyTokens } = require("./shared/uniswap")

use(solidity)

describe("Distributor", function () {
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()
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

    const fixtures = await loadFixtures(provider, wallet, distributor, user2)
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

    await distributor.initialize(
      [
        xvix.address,
        weth.address,
        dai.address,
        lgeTokenWETH.address,
        lgeTokenDAI.address,
        floor.address,
        minter.address,
        router.address,
        factory.address
      ],
      lgeEndTime,
      lpUnlockTime
    )

    await xvix.createSafe(distributor.address)
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

    expect(await lgeTokenWETH.distributor()).eq(distributor.address)
    expect(await lgeTokenDAI.distributor()).eq(distributor.address)
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
    await xvix.transfer(distributor.address, expandDecimals(1000, 18))

    await dai.mint(wallet.address, expandDecimals(90000, 18))
    await addLiquidityETH({ router, wallet, token: dai,
      tokenAmount: expandDecimals(90000, 18), ethAmount: expandDecimals(20, 18) })

    let blockTime = await getBlockTime(provider)
    await distributor.join(user1.address, expandDecimals(10, 18), blockTime + 60, { value: expandDecimals(1, 18) })

    await expect(distributor.connect(user0).endLGE(blockTime + 60))
      .to.be.revertedWith("Distributor: forbidden")

    await increaseTime(provider, 42 * 24 * 60 * 60 + 10)
    await mineBlock(provider)
    await xvix.rebase()

    blockTime = await getBlockTime(provider)

    const wethPair = pairs.xvix.weth
    const daiPair = pairs.xvix.dai

    expect(await provider.getBalance(wethPair.address), 0)
    expect(await weth.balanceOf(wethPair.address), "0")
    expect(await xvix.balanceOf(wethPair.address), "0")
    expect(await wethPair.balanceOf(distributor.address), "0")

    expect(await provider.getBalance(daiPair.address), 0)
    expect(await dai.balanceOf(daiPair.address), "0")
    expect(await xvix.balanceOf(daiPair.address), "0")
    expect(await daiPair.balanceOf(distributor.address), "0")

    expect(await lgeTokenWETH.refBalance()).eq("0")
    expect(await lgeTokenWETH.refSupply()).eq("0")

    expect(await lgeTokenDAI.refBalance()).eq("0")
    expect(await lgeTokenDAI.refSupply()).eq("0")

    await expect(minter.mint(wallet.address))
      .to.be.revertedWith("Minter: not active")

    expect(await floor.getRefundAmount(expandDecimals(1000, 18))).eq("451943991187955960") // ~0.451
    expect(await minter.active()).eq(false)
    expect(await minter.ethReserve()).eq(0)
    await distributor.connect(user0).endLGE(blockTime + 60)
    expect(await minter.active()).eq(true)
    expect(await minter.ethReserve()).eq(expandDecimals(1, 18))

    // 1 ETH => 200 XVIX
    // 1 ETH => 4500 DAI
    // 1 XVIX => 22.5 DAI
    expect(await provider.getBalance(wethPair.address), 0)
    expect(await weth.balanceOf(wethPair.address), "250000000000000000") // 0.25 ETH
    expect(await xvix.balanceOf(wethPair.address), "49501250000000000000") // ~50 XVIX
    expect(await wethPair.balanceOf(distributor.address), "3517856236403072933")

    expect(await provider.getBalance(daiPair.address), 0)
    expect(await dai.balanceOf(daiPair.address), "1107818808104003851994") // ~1107 DAI
    expect(await xvix.balanceOf(daiPair.address), "49501250000000000000") // ~50 XVIX
    expect(await daiPair.balanceOf(distributor.address), "234176035867588979498")

    expect(await lgeTokenWETH.refBalance()).eq("250000000000000000")
    expect(await lgeTokenWETH.refSupply()).eq(expandDecimals(1, 18))

    expect(await lgeTokenDAI.refBalance()).eq("1107818808104003851994")
    expect(await lgeTokenDAI.refSupply()).eq(expandDecimals(1, 18))

    await expect(distributor.connect(user0).endLGE(blockTime + 60))
      .to.be.revertedWith("Distributor: LGE already ended")

    expect(await xvix.balanceOf(user2.address)).eq(0)
    // 1000 XVIX and 1 ETH was sent to the distributor
    // 500 XVIX and 0.25 ETH would be sent to the XVIX / ETH Uniswap pair
    // price in the Uniswap pair would be ~2000 XVIX / 1 ETH
    await buyTokens({ router, wallet, receiver: user2, weth,
      token: xvix, ethAmount: "1000000000000000" }) // 0.001 ETH
    expect(await xvix.balanceOf(user2.address)).eq("1956437029874859062") // ~1.956 XVIX, ~0.001 * 2000

    expect(await xvix.balanceOf(user3.address)).eq(0)
    // the minter has a tokenReserve of 1000 XVIX
    // the minter would be initialized with an ethReserve of 1 ETH
    // price in the minter would be ~1000 XVIX / 1 ETH
    // it will be slightly more because some XVIX has already been burnt during setup
    await minter.mint(user3.address, { value: "1000000000000000" }) // 0.001 ETH
    expect(await xvix.balanceOf(user3.address)).eq("1007580772641918183") // ~1.007 XVIX, 0.001 * 1000
  })

  it("removeLiquidityETH, removeLiquidityDAI", async () => {
    await xvix.setFund(user2.address)
    const receiver0 = { address: "0x7182B123AD5F6619B66533A85B6f180462AED05E" }
    const receiver1 = { address: "0x10fd90D8f1543FFF6B8056BCf40dfB39231781c4" }

    await xvix.transfer(distributor.address, expandDecimals(1000, 18))

    await dai.mint(wallet.address, expandDecimals(90000, 18))
    await addLiquidityETH({ router, wallet, token: dai,
      tokenAmount: expandDecimals(90000, 18), ethAmount: expandDecimals(20, 18) })

    let blockTime = await getBlockTime(provider)
    await distributor.join(user0.address, expandDecimals(10, 18), blockTime + 60, { value: expandDecimals(1, 18) })
    await distributor.join(user1.address, expandDecimals(10, 18), blockTime + 60, { value: expandDecimals(2, 17) })

    expect(await lgeTokenWETH.totalSupply()).eq("1200000000000000000") // 1.2
    expect(await lgeTokenDAI.totalSupply()).eq("1200000000000000000") // 1.2

    const wethPair = pairs.xvix.weth
    const daiPair = pairs.xvix.dai

    expect(await floor.getRefundAmount(expandDecimals(1000, 18))).eq("542332027719192527") // ~0.542
    expect(await minter.active()).eq(false)
    expect(await minter.ethReserve()).eq(0)
    expect(await provider.getBalance(distributor.address)).eq("300000000000000000") // 0.3 ETH
    expect(await provider.getBalance(floor.address)).eq("600000000000000000") // 0.6 ETH
    expect(await provider.getBalance(wethPair.address)).eq(0)
    expect(await weth.balanceOf(wethPair.address)).eq(0)
    expect(await weth.balanceOf(daiPair.address)).eq(0)
    expect(await dai.balanceOf(distributor.address)).eq("1326109841407994541973") // ~1326 DAI
    expect(await dai.balanceOf(wethPair.address)).eq(0)
    expect(await dai.balanceOf(daiPair.address)).eq(0)
    expect(await xvix.balanceOf(distributor.address)).eq("995000000000000000000") // 995, 1000 - 5
    expect(await xvix.balanceOf(wethPair.address)).eq(0)
    expect(await xvix.balanceOf(daiPair.address)).eq(0)

    await distributor.endLGE(blockTime + 60)

    expect(await minter.active()).eq(true)
    expect(await minter.ethReserve()).eq("1200000000000000000") // 1.2 ETH
    expect(await provider.getBalance(distributor.address)).eq(0) // 0.3 ETH sent to XVIX / WETH pair
    expect(await provider.getBalance(floor.address)).eq("600000000000000000") // 0.6 ETH
    expect(await provider.getBalance(wethPair.address)).eq(0)
    expect(await provider.getBalance(wethPair.address)).eq(0)
    expect(await weth.balanceOf(wethPair.address)).eq("300000000000000000") // 0.3
    expect(await weth.balanceOf(daiPair.address)).eq(0)
    expect(await dai.balanceOf(wethPair.address)).eq(0)
    expect(await dai.balanceOf(daiPair.address)).eq("1326109841407994541973") // ~1326 DAI
    expect(await xvix.balanceOf(distributor.address)).eq(0)
    expect(await xvix.balanceOf(wethPair.address)).eq("495012500000000000000") // 495.0125
    expect(await xvix.balanceOf(daiPair.address)).eq("495012500000000000000") // 495.0125

    await increaseTime(provider, await getRebaseTime(provider, xvix, 45 * 24))
    await mineBlock(provider)
    await xvix.rebase()

    blockTime = await getBlockTime(provider)

    expect(await xvix.totalSupply()).eq("989440837331829144418") // ~989.44
    expect(await minter.tokenReserve()).eq("1010559162668170855582") // ~1010.56
    expect(await provider.getBalance(receiver0.address)).eq(0)
    expect(await xvix.balanceOf(receiver0.address)).eq(0)
    await distributor.connect(user0).removeLiquidityETH(expandDecimals(5, 17), 0, 0, receiver0.address, blockTime + 60)
    expect(await provider.getBalance(receiver0.address)).eq("236879911258169118") // ~0.237 ETH
    expect(await xvix.balanceOf(receiver0.address)).eq(0)
    expect(await xvix.totalSupply()).eq("783741776025252666133") // ~783.74
    expect(await minter.tokenReserve()).eq("1216258223974747333867") // ~1216.26

    await distributor.connect(user0).removeLiquidityETH(expandDecimals(5, 17), 0, 0, receiver0.address, blockTime + 60)
    expect(await provider.getBalance(receiver0.address)).eq("476813362730091822") // ~0.477 ETH
    expect(await xvix.balanceOf(receiver0.address)).eq(0)

    await expect(distributor.connect(user0).removeLiquidityETH(1, 0, 0, receiver0.address, blockTime + 60))
      .to.be.revertedWith("LGEToken: burn amount exceeds balance")

    expect(await provider.getBalance(receiver1.address)).eq(0)
    await distributor.connect(user1).removeLiquidityETH(expandDecimals(1, 17), 0, 0, receiver1.address, blockTime + 60)
    expect(await provider.getBalance(receiver0.address)).eq("476813362730091822") // ~0.0477 ETH

    await distributor.connect(user1).removeLiquidityETH(expandDecimals(1, 17), 0, 0, receiver1.address, blockTime + 60)
    expect(await provider.getBalance(receiver1.address)).eq("97806464823357572") // ~0.0978 ETH

    // retrieved ETH: 0.477 + 0.0978 = 0.5748 ETH

    await expect(distributor.connect(user1).removeLiquidityETH(1, 0, 0, receiver1.address, blockTime + 60))
      .to.be.revertedWith("LGEToken: burn amount exceeds balance")

    expect(await dai.balanceOf(receiver0.address)).eq(0)
    expect(await provider.getBalance(receiver0.address)).eq("476813362730091822") // ~0.477 ETH
    await distributor.connect(user0).removeLiquidityDAI(expandDecimals(5, 17), 0, 0, receiver0.address, blockTime + 60)
    expect(await dai.balanceOf(receiver0.address)).eq("552545767253331058471") // ~552 DAI
    expect(await provider.getBalance(receiver0.address)).eq("598011230986316852") // ~0.598 ETH

    await distributor.connect(user0).removeLiquidityDAI(expandDecimals(5, 17), 0, 0, receiver0.address, blockTime + 60)
    expect(await dai.balanceOf(receiver0.address)).eq("1105091534506662116945") // ~1105 DAI
    expect(await provider.getBalance(receiver0.address)).eq("728164028320556981") // ~0.728 ETH

    await expect(distributor.connect(user0).removeLiquidityDAI(1, 0, 0, receiver0.address, blockTime + 60))
      .to.be.revertedWith("LGEToken: burn amount exceeds balance")

    expect(await dai.balanceOf(receiver1.address)).eq(0)
    expect(await provider.getBalance(receiver1.address)).eq("97806464823357572") // ~0.0978 ETH
    await distributor.connect(user1).removeLiquidityDAI(expandDecimals(1, 17), 0, 0, receiver1.address, blockTime + 60)
    expect(await dai.balanceOf(receiver1.address)).eq("110509153450666211695") // ~110.5 DAI
    expect(await provider.getBalance(receiver1.address)).eq("130227849479878914") // ~0.130 ETH

    await distributor.connect(user1).removeLiquidityDAI(expandDecimals(1, 17), 0, 0, receiver1.address, blockTime + 60)
    expect(await dai.balanceOf(receiver1.address)).eq("221018306901332423391") // ~221 DAI
    expect(await provider.getBalance(receiver1.address)).eq("165861132053227734") // ~0.166 ETH

    await expect(distributor.connect(user1).removeLiquidityDAI(1, 0, 0, receiver1.address, blockTime + 60))
      .to.be.revertedWith("LGEToken: burn amount exceeds balance")

    expect(await provider.getBalance(floor.address)).eq("5974839626215260") // 0.00597 ETH

    // retrieved ETH: 0.728 + 0.166 + 0.00597 = ~0.9 ETH, 75% of 1.2 ETH
    // retrieved DAI: 1105 + 221 = 1326 DAI, ~0.295 ETH, 1326 / 4500

    expect(await weth.balanceOf(wethPair.address)).eq("25")
    expect(await dai.balanceOf(daiPair.address)).eq("1637")

    expect(await xvix.balanceOf(wethPair.address)).eq("40532")
    expect(await xvix.balanceOf(daiPair.address)).eq("610")

    expect(await xvix.balanceOf(distributor.address)).eq("0")
    expect(await xvix.balanceOf(user2.address)).eq("2084926075795882276")

    expect(await provider.getBalance(receiver1.address)).eq("165861132053227734") // ~0.166 ETH
    await floor.connect(user2).refund(receiver1.address, "2084926075795882276")
    expect(await provider.getBalance(receiver1.address)).eq("171238487716821361") // ~0.171 ETH

    expect(await xvix.balanceOf(user2.address)).eq("0")
    expect(await xvix.totalSupply()).eq("41143") // 40532 + 610 = 41142
    expect(await xvix.maxSupply()).eq(expandDecimals(2000, 18))

    expect(await provider.getBalance(floor.address)).eq("597483962621633")
  })

  it("removeLiquidityETH, removeLiquidityDAI when XVIX price increases", async () => {
    await xvix.setFund(user2.address)
    const receiver0 = { address: "0xd255aa73efad1e005aea0933580b38a5947ea6b8" }

    await xvix.transfer(distributor.address, expandDecimals(1000, 18))

    await dai.mint(wallet.address, expandDecimals(90000, 18))
    await addLiquidityETH({ router, wallet, token: dai,
      tokenAmount: expandDecimals(90000, 18), ethAmount: expandDecimals(20, 18) })

    let blockTime = await getBlockTime(provider)
    await distributor.join(user0.address, expandDecimals(10, 18), blockTime + 60, { value: expandDecimals(1, 18) })
    await distributor.join(user1.address, expandDecimals(10, 18), blockTime + 60, { value: expandDecimals(2, 17) })

    await increaseTime(provider, 42 * 24 * 60 * 60 + 10)
    await mineBlock(provider)
    await xvix.rebase()

    blockTime = await getBlockTime(provider)
    await distributor.endLGE(blockTime + 60)

    // the XVIX / ETH Uniswap pair has 0.3 ETH
    // a buy of 0.03 ETH would raise the price by 21%
    await buyTokens({ router, wallet, receiver: wallet, weth, token: xvix, ethAmount: "30000000000000000" }) // 0.03 ETH

    expect(await provider.getBalance(receiver0.address)).eq(0)
    const totalSupply = await xvix.totalSupply()
    const maxSupply = await xvix.maxSupply()
    await distributor.connect(user0).removeLiquidityETH(expandDecimals(1, 18), 0, 0, receiver0.address, blockTime + 60)
    const nextTotalSupply = await xvix.totalSupply()
    const nextMaxSupply = await xvix.maxSupply()
    expect(await provider.getBalance(receiver0.address)).eq("458296491001592633")
    expect(totalSupply.sub(nextTotalSupply)).eq("374849194666727258489") // ~374.85
    expect(maxSupply.sub(nextMaxSupply)).eq("37323621404322387892") // ~37.32
    expect(nextMaxSupply).eq("1962676378595677612108") // ~1962.67
  })

  it("LGEToken.mint", async () => {
    await expect(lgeTokenWETH.mint(user0.address, 1))
      .to.be.revertedWith("LGEToken: forbidden")
  })

  it("LGEToken.burn", async () => {
    await expect(lgeTokenWETH.burn(user0.address, 1))
      .to.be.revertedWith("LGEToken: forbidden")
  })

  it("LGEToken.setRefBalance", async () => {
    await expect(lgeTokenWETH.setRefBalance(1))
      .to.be.revertedWith("LGEToken: forbidden")
  })

  it("LGEToken.setRefSupply", async () => {
    await expect(lgeTokenWETH.setRefSupply(1))
      .to.be.revertedWith("LGEToken: forbidden")
  })
})
