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
  const latte = await deployContract("Latte", [expandDecimals(10000, 18)])
  const weth = await deployContract("WETH", [])

  const factory = await deployContract("UniswapV2Factory", [wallet.address])
  const router = await deployContract("UniswapV2Router", [factory.address, weth.address], { gasLimit: 6000000 })

  await factory.createPair(latte.address, weth.address)
  const pairAddress = await factory.getPair(latte.address, weth.address)
  const pair = await contractAt("UniswapV2Pair", pairAddress)

  const pricer = await deployContract("Pricer", [pair.address, latte.address])
  const shopper = await deployContract("Shopper", [latte.address, pricer.address])
  const pool = await deployContract("Pool", [latte.address, pricer.address])
  const market = await deployContract("Market", [latte.address, weth.address, pool.address, factory.address])
  const cafe = await deployContract("Cafe", [latte.address, pricer.address, shopper.address, pool.address])

  await latte.setCafe(cafe.address)
  await latte.setShopper(shopper.address)
  await latte.setPricer(pricer.address)
  await latte.setPool(pool.address)

  await pool.setMarket(market.address)

  return { latte, weth, router, pair, pricer, shopper, pool, market, cafe }
}

module.exports = {
  loadFixtures
}
