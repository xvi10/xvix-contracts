const WETH = require("../../artifacts/WETH.json")
const UniswapV2Pair = require("../../artifacts/UniswapV2Pair.json")

const { expandDecimals } = require("./utilities")

async function deployContract(name, args) {
  const contractFactory = await ethers.getContractFactory(name);
  return await contractFactory.deploy(...args);
}

async function contractAt(name, address) {
  const contractFactory = await ethers.getContractFactory(name);
  return await contractFactory.attach(address);
}

async function printPairBytecode() {
  console.log("UniswapV2Pair.bytecode", ethers.utils.keccak256(UniswapV2Pair.bytecode))
}

async function loadFixtures(provider, wallet) {
  const lp = "0xe19A173F0d35dcFC706dD3Adb2260f5c7431f720"
  const fund = "0xADCE46A8724eB9828391648302C58C483e0d777A"

  const initialSupply = expandDecimals(1000, 18)
  const maxSupply = expandDecimals(2000, 18)
  const xvix = await deployContract("XVIX", [initialSupply, maxSupply])
  const weth = await deployContract("WETH", [])

  const factory = await deployContract("UniswapV2Factory", [wallet.address])
  const router = await deployContract("UniswapV2Router", [factory.address, weth.address], { gasLimit: 6000000 })

  await factory.createPair(xvix.address, weth.address)
  const pairAddress = await factory.getPair(xvix.address, weth.address)
  const pair = await contractAt("UniswapV2Pair", pairAddress)

  const floor = await deployContract("Floor", [xvix.address])
  const market = await deployContract("MarketMock", [weth.address, factory.address])
  const minter = await deployContract("Minter", [xvix.address, floor.address, expandDecimals(400, 18)])

  await xvix.setMinter(minter.address)
  await xvix.setFloor(floor.address)

  await xvix.addExemption(pair.address)
  await xvix.addExemption(market.address)

  return { xvix, weth, router, pair, floor, market, minter, lp, fund }
}

module.exports = {
  deployContract,
  loadFixtures
}
