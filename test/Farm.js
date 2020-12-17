const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { addLiquidityETH } = require("./shared/uniswap")
const { expandDecimals } = require("./shared/utilities")

use(solidity)

describe("Farm", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet, user0, user1, user2] = provider.getWallets()
  let router
  let xvix
  let stakingToken
  let rewardToken
  let farm
  let farmDistributor

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    router = fixtures.router
    xvix = fixtures.xvix
    stakingToken = fixtures.pairs.xvix.weth
    rewardToken = fixtures.dai
    farmDistributor = await deployContract("FarmDistributor", [rewardToken.address])
    farm = await deployContract("Farm", [stakingToken.address, rewardToken.address])
    await farm.setFarmDistributor(farmDistributor.address)
    await rewardToken.mint(wallet.address, 10000)
  })

  it("inits", async () => {
    expect(await farm.rewardToken()).eq(rewardToken.address)
    expect(await farm.stakingToken()).eq(stakingToken.address)
  })

  it("setGov", async () => {
    await expect(farm.connect(user0).setGov(user1.address))
      .to.be.revertedWith("Farm: forbidden")

    await farm.setGov(user0.address)
    expect(await farm.gov()).eq(user0.address)

    await farm.connect(user0).setGov(user1.address)
    expect(await farm.gov()).eq(user1.address)
  })

  it("setFarmDistributor", async () => {
    await expect(farm.connect(user0).setFarmDistributor(user1.address))
      .to.be.revertedWith("Farm: forbidden")

    await farm.setGov(user0.address)
    expect(await farm.gov()).eq(user0.address)

    await farm.connect(user0).setFarmDistributor(user1.address)
    expect(await farm.farmDistributor()).eq(user1.address)
  })

  it("stake for 1", async () => {
    const receiver0 = { address: "0x991864f1a6a7c0188cff3856bc71dc3e062c7f59" }
    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    await expect(farm.connect(user0).stake(100)).to.be.reverted

    await addLiquidityETH({ router, wallet, token: xvix, tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })
    await stakingToken.transfer(user0.address, 100)

    expect(await stakingToken.balanceOf(user0.address)).eq(100)
    await stakingToken.connect(user0).approve(farm.address, 100)
    await farm.connect(user0).stake(100)
    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(100)

    await rewardToken.transfer(farmDistributor.address, 500)

    expect(await rewardToken.balanceOf(receiver0.address)).eq(0)
    await farm.connect(user0).claim(receiver0.address)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(500)

    await rewardToken.transfer(farmDistributor.address, 200)

    await farm.connect(user0).claim(receiver0.address)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(700)
  })

  it("stake for 2", async () => {
    const receiver0 = { address: "0xc6adf1534773ea25b25d8aa873069e211d7730da" }
    const receiver1 = { address: "0x8a484b58eca9b69f75d03ed8675ff76f721dde77" }

    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)

    await addLiquidityETH({ router, wallet, token: xvix, tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })
    await stakingToken.transfer(user0.address, 100)
    await stakingToken.transfer(user1.address, 300)

    expect(await stakingToken.balanceOf(user0.address)).eq(100)
    await stakingToken.connect(user0).approve(farm.address, 100)
    await farm.connect(user0).stake(100)
    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(100)

    await rewardToken.transfer(farmDistributor.address, 500)

    expect(await stakingToken.balanceOf(user1.address)).eq(300)
    await stakingToken.connect(user1).approve(farm.address, 300)
    await farm.connect(user1).stake(300)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(400)

    await rewardToken.transfer(farmDistributor.address, 200)

    expect(await rewardToken.balanceOf(receiver0.address)).eq(0)
    await farm.connect(user0).claim(receiver0.address)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(550) // 500 + 50

    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    await farm.connect(user1).claim(receiver1.address)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(150)
  })

  it("stake for 3", async () => {
    const receiver0 = { address: "0x67d71e33c902637a63cac6414b719b031f8ec486" }
    const receiver1 = { address: "0xeec92c01c5ba99620cc801f8c3d50af7ddeffd49" }
    const receiver2 = { address: "0x57173d5bb7db1109ce0c455361bc61f39c36cdc9" }

    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(user2.address)).eq(0)

    await addLiquidityETH({ router, wallet, token: xvix, tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })
    await stakingToken.transfer(user0.address, 100)
    await stakingToken.transfer(user1.address, 300)
    await stakingToken.transfer(user2.address, 600)

    expect(await stakingToken.balanceOf(user0.address)).eq(100)
    await stakingToken.connect(user0).approve(farm.address, 100)
    await farm.connect(user0).stake(100)
    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(100)

    await rewardToken.transfer(farmDistributor.address, 500)

    expect(await stakingToken.balanceOf(user1.address)).eq(300)
    await stakingToken.connect(user1).approve(farm.address, 300)
    await farm.connect(user1).stake(300)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(400)

    await rewardToken.transfer(farmDistributor.address, 200)

    expect(await rewardToken.balanceOf(receiver0.address)).eq(0)
    await farm.connect(user0).unstake(user0.address, 100)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(300)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    await farm.connect(user1).claim(receiver1.address)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(150)

    expect(await stakingToken.balanceOf(user2.address)).eq(600)
    await stakingToken.connect(user2).approve(farm.address, 600)
    await farm.connect(user2).stake(600)
    expect(await stakingToken.balanceOf(user2.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(900)

    await rewardToken.transfer(farmDistributor.address, 3000)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(150)
    await farm.connect(user1).claim(receiver1.address)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(1149)

    expect(await rewardToken.balanceOf(receiver2.address)).eq(0)
    await farm.connect(user2).claim(receiver2.address)
    expect(await rewardToken.balanceOf(receiver2.address)).eq(1999)

    expect(await rewardToken.balanceOf(receiver0.address)).eq(0)
    await farm.connect(user0).claim(receiver0.address)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(550)
  })

  it("unstake", async () => {
    const receiver0 = { address: "0x17ff6925ed886db61edb8576597f7f5d3dd8240b" }
    const receiver1 = { address: "0xec1a718d1a6f8f8d94ecec6fe91465697bb2b88c" }
    const receiver2 = { address: "0x3da9708490c83e6c5aec40539ad39c9d2c4e5319" }

    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(user2.address)).eq(0)

    await addLiquidityETH({ router, wallet, token: xvix, tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })
    await stakingToken.transfer(user0.address, 100)
    await stakingToken.transfer(user1.address, 300)
    await stakingToken.transfer(user2.address, 600)

    expect(await stakingToken.balanceOf(user0.address)).eq(100)
    await stakingToken.connect(user0).approve(farm.address, 100)
    await farm.connect(user0).stake(100)
    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(100)

    await rewardToken.transfer(farmDistributor.address, 500)

    expect(await stakingToken.balanceOf(user1.address)).eq(300)
    await stakingToken.connect(user1).approve(farm.address, 300)
    await farm.connect(user1).stake(300)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(400)

    await rewardToken.transfer(farmDistributor.address, 200)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    await farm.connect(user1).unstake(user1.address, 100)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(300)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    await farm.connect(user1).claim(receiver1.address)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(150)

    expect(await stakingToken.balanceOf(user2.address)).eq(600)
    await stakingToken.connect(user2).approve(farm.address, 600)
    await farm.connect(user2).stake(600)
    expect(await stakingToken.balanceOf(user2.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(900)

    await rewardToken.transfer(farmDistributor.address, 1800)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(150)
    await farm.connect(user1).claim(receiver1.address)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(550)

    expect(await rewardToken.balanceOf(receiver2.address)).eq(0)
    await farm.connect(user2).claim(receiver2.address)
    expect(await rewardToken.balanceOf(receiver2.address)).eq(1200)

    expect(await rewardToken.balanceOf(receiver0.address)).eq(0)
    await farm.connect(user0).claim(receiver0.address)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(750)
  })

  it("unstake to zero", async () => {
    const receiver0 = { address: "0x3a82efac770286f6001cb75ce6600b12898bd7f5" }
    const receiver1 = { address: "0x27ad623c104d796cb964da4095a499f99f33ab93" }
    const receiver2 = { address: "0xdac17f958d2ee523a2206206994597c13d831ec7" }

    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(user2.address)).eq(0)

    await addLiquidityETH({ router, wallet, token: xvix, tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })
    await stakingToken.transfer(user0.address, 100)
    await stakingToken.transfer(user1.address, 300)
    await stakingToken.transfer(user2.address, 600)

    expect(await stakingToken.balanceOf(user0.address)).eq(100)
    await stakingToken.connect(user0).approve(farm.address, 100)
    await farm.connect(user0).stake(100)
    expect(await stakingToken.balanceOf(user0.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(100)

    await rewardToken.transfer(farmDistributor.address, 500)

    expect(await stakingToken.balanceOf(user1.address)).eq(300)
    await stakingToken.connect(user1).approve(farm.address, 300)
    await farm.connect(user1).stake(300)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(400)

    await rewardToken.transfer(farmDistributor.address, 200)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    await farm.connect(user1).unstake(user1.address, 100)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(300)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(0)
    await farm.connect(user1).claim(receiver1.address)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(150)

    expect(await stakingToken.balanceOf(user2.address)).eq(600)
    await stakingToken.connect(user2).approve(farm.address, 600)
    await farm.connect(user2).stake(600)
    expect(await stakingToken.balanceOf(user2.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(900)

    await rewardToken.transfer(farmDistributor.address, 1800)

    expect(await rewardToken.balanceOf(receiver1.address)).eq(150)
    await farm.connect(user1).claim(receiver1.address)
    expect(await rewardToken.balanceOf(receiver1.address)).eq(550)

    expect(await rewardToken.balanceOf(receiver2.address)).eq(0)
    await farm.connect(user2).claim(receiver2.address)
    expect(await rewardToken.balanceOf(receiver2.address)).eq(1200)

    expect(await rewardToken.balanceOf(receiver0.address)).eq(0)
    await farm.connect(user0).claim(receiver0.address)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(750)

    await farm.connect(user0).unstake(user0.address, 100)
    await farm.connect(user1).unstake(user1.address, 200)
    await farm.connect(user2).unstake(user2.address, 600)
    expect(await stakingToken.balanceOf(farm.address)).eq(0)
    expect(await rewardToken.balanceOf(farm.address)).eq(0)

    await stakingToken.connect(user0).approve(farm.address, 100)
    await farm.connect(user0).stake(100)

    await rewardToken.transfer(farmDistributor.address, 700)

    expect(await rewardToken.balanceOf(receiver0.address)).eq(750)
    await farm.connect(user0).exit(receiver0.address, 100)
    expect(await rewardToken.balanceOf(receiver0.address)).eq(1450)
  })
})
