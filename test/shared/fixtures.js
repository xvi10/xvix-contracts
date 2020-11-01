const WETH = require("../../artifacts/WETH.json")
const UniswapV2Pair = require("../../artifacts/UniswapV2Pair.json")
const UniswapV2Factory = require("../../artifacts/UniswapV2Factory.json")
const UniswapV2Router = require("../../artifacts/UniswapV2Router.json")
const Latte = require("../../artifacts/Latte.json")

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
  const latte = await deployContract("Latte", [initialSupply, maxSupply])
  const weth = await deployContract("WETH", [])

  const factory = await deployContract("UniswapV2Factory", [wallet.address])
  const router = await deployContract("UniswapV2Router", [factory.address, weth.address], { gasLimit: 6000000 })

  await factory.createPair(latte.address, weth.address)
  const pairAddress = await factory.getPair(latte.address, weth.address)
  const pair = await contractAt("UniswapV2Pair", pairAddress)

  const pool = await deployContract("Pool", [latte.address])
  const market = await deployContract("Market", [weth.address, factory.address])
  const cafe = await deployContract("Cafe", [latte.address, pool.address, expandDecimals(400, 18)])
  const distributor = await deployContract("Distributor", [latte.address, pool.address, lp, fund, 5, 2, expandDecimals(20, 18), expandDecimals(15, 18)])

  await latte.setCafe(cafe.address)
  await latte.setPool(pool.address)
  await latte.setDistributor(distributor.address)

  await latte.addExemption(pair.address)
  await latte.addExemption(market.address)

  return { latte, weth, router, pair, pool, market, cafe, distributor, lp, fund }
}

module.exports = {
  deployContract,
  loadFixtures
}
