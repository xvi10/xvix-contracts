const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { loadFixtures, deployContract } = require("./shared/fixtures")
const { addLiquidityETH } = require("./shared/uniswap")
const { expandDecimals } = require("./shared/utilities")

use(solidity)

describe("Farm", function () {
  const distributor = { address: "0x92e235D65A9E3c5231688e70dc3fF0c91d17cf8C" }
  const provider = waffle.provider
  const [wallet, user0, user1] = provider.getWallets()
  let router
  let xvix
  let stakingToken
  let farm
  let farmDistributor

  beforeEach(async () => {
    const fixtures = await loadFixtures(provider, wallet, distributor)
    router = fixtures.router
    xvix = fixtures.xvix
    stakingToken = fixtures.pairs.xvix.weth
    farmDistributor = await deployContract("FarmDistributor", [])
    farm = await deployContract("Farm", [stakingToken.address, farmDistributor.address])
  })

  // it("inits", async () => {
  //   expect(await farm.stakingToken()).eq(stakingToken.address)
  //   expect(await farm.farmDistributor()).eq(farmDistributor.address)
  // })

  // it("stake for 1", async () => {
  //   const receiver0 = { address: "0x991864f1a6a7c0188cff3856bc71dc3e062c7f59" }
  //   expect(await stakingToken.balanceOf(user0.address)).eq(0)
  //   await expect(farm.connect(user0).stake(100)).to.be.reverted
  //
  //   await addLiquidityETH({ router, wallet, token: xvix, tokenAmount: expandDecimals(100, 18), ethAmount: expandDecimals(40, 18) })
  //   await stakingToken.transfer(user0.address, 100)
  //
  //   expect(await stakingToken.balanceOf(user0.address)).eq(100)
  //   await stakingToken.connect(user0).approve(farm.address, 100)
  //   await farm.connect(user0).stake(100)
  //   expect(await stakingToken.balanceOf(user0.address)).eq(0)
  //   expect(await stakingToken.balanceOf(farm.address)).eq(100)
  //
  //   await wallet.sendTransaction({ to: farmDistributor.address, value: 500 })
  //
  //   expect(await provider.getBalance(receiver0.address)).eq(0)
  //   await farm.connect(user0).claim(receiver0.address)
  //   expect(await provider.getBalance(receiver0.address)).eq(500)
  //
  //   await wallet.sendTransaction({ to: farmDistributor.address, value: 200 })
  //
  //   await farm.connect(user0).claim(receiver0.address)
  //   expect(await provider.getBalance(receiver0.address)).eq(700)
  // })

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

    await wallet.sendTransaction({ to: farmDistributor.address, value: 500 })

    expect(await stakingToken.balanceOf(user1.address)).eq(300)
    await stakingToken.connect(user1).approve(farm.address, 300)
    await farm.connect(user1).stake(300)
    expect(await stakingToken.balanceOf(user1.address)).eq(0)
    expect(await stakingToken.balanceOf(farm.address)).eq(400)

    await wallet.sendTransaction({ to: farmDistributor.address, value: 200 })

    expect(await provider.getBalance(receiver0.address)).eq(0)
    await farm.connect(user0).claim(receiver0.address)
    expect(await provider.getBalance(receiver0.address)).eq(550) // 500 + 50

    expect(await provider.getBalance(receiver1.address)).eq(0)
    await farm.connect(user1).claim(receiver1.address)
    expect(await provider.getBalance(receiver1.address)).eq(150)
  })
})
