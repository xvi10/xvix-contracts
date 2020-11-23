const UniswapV2Pair = require("../../artifacts/UniswapV2Pair.json")

const { expandDecimals } = require("./utilities")

async function deployContract(name, args) {
  const contractFactory = await ethers.getContractFactory(name)
  return await contractFactory.deploy(...args)
}

async function contractAt(name, address) {
  const contractFactory = await ethers.getContractFactory(name)
  return await contractFactory.attach(address)
}

async function printPairBytecode() {
  console.info("UniswapV2Pair.bytecode", ethers.utils.keccak256(UniswapV2Pair.bytecode))
}

async function loadFixtures(provider, wallet, distributor) {
  const fund = { address: "0xB858587Bd4419542407BC40256fe0a428595Ffde" }
  const govHandoverTime = 1 // for testing convenience use a govHandoverTime that has already passed
  const initialSupply = expandDecimals(1000, 18)
  const maxSupply = expandDecimals(2000, 18)
  const xvix = await deployContract("XVIX", [initialSupply, maxSupply, govHandoverTime])
  const weth = await deployContract("WETH", [])
  const dai = await deployContract("DAI", [])

  const pairs = { xvix: {}, weth: {} }

  const factory = await deployContract("UniswapV2Factory", [wallet.address])
  const router = await deployContract("UniswapV2Router", [factory.address, weth.address], { gasLimit: 6000000 })

  await factory.createPair(xvix.address, weth.address)
  const xvixWethPairAddress = await factory.getPair(xvix.address, weth.address)
  pairs.xvix.weth = await contractAt("UniswapV2Pair", xvixWethPairAddress)

  await factory.createPair(xvix.address, dai.address)
  const xvixDaiPairAddress = await factory.getPair(xvix.address, dai.address)
  pairs.xvix.dai = await contractAt("UniswapV2Pair", xvixDaiPairAddress)

  await factory.createPair(weth.address, dai.address)
  const wethDaiPairAddress = await factory.getPair(weth.address, dai.address)
  pairs.weth.dai = await contractAt("UniswapV2Pair", wethDaiPairAddress)

  const floor = await deployContract("Floor", [xvix.address])
  const minter = await deployContract("Minter", [xvix.address, floor.address, distributor.address])

  await xvix.setMinter(minter.address)
  await xvix.setFloor(floor.address)
  await xvix.setDistributor(distributor.address)
  await xvix.setFund(fund.address)

  return { xvix, weth, dai, router, factory, pairs, floor, minter, distributor, fund }
}

module.exports = {
  deployContract,
  contractAt,
  loadFixtures,
  printPairBytecode
}
