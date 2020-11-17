const WETH = require("../../artifacts/WETH.json")
const UniswapV2Pair = require("../../artifacts/UniswapV2Pair.json")

const { expandDecimals, getBlockTime } = require("./utilities")

async function deployContract(name, args) {
  const contractFactory = await ethers.getContractFactory(name);
  return await contractFactory.deploy(...args);
}

async function contractAt(name, address) {
  const contractFactory = await ethers.getContractFactory(name);
  return await contractFactory.attach(address);
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

  const factory = await deployContract("UniswapV2Factory", [wallet.address])
  const router = await deployContract("UniswapV2Router", [factory.address, weth.address], { gasLimit: 6000000 })

  await factory.createPair(xvix.address, weth.address)
  const pairAddress = await factory.getPair(xvix.address, weth.address)
  const pair = await contractAt("UniswapV2Pair", pairAddress)

  const floor = await deployContract("Floor", [xvix.address])
  const minter = await deployContract("Minter", [xvix.address, floor.address, distributor.address])

  await xvix.setMinter(minter.address)
  await xvix.setFloor(floor.address)
  await xvix.setDistributor(distributor.address)
  await xvix.setFund(fund.address)

  await xvix.createSafe(distributor.address)

  return { xvix, weth, router, pair, floor, minter, distributor, fund }
}

module.exports = {
  deployContract,
  loadFixtures
}
