const WETH = require("../../artifacts/WETH.json")
const UniswapV2Pair = require("../../artifacts/UniswapV2Pair.json")
const UniswapV2Factory = require("../../artifacts/UniswapV2Factory.json")
const UniswapV2Router = require("../../artifacts/UniswapV2Router.json")

const Latte = require("../../artifacts/Latte.json")
const Pricer = require("../../artifacts/Pricer.json")
const Shopper = require("../../artifacts/Shopper.json")
const Pool = require("../../artifacts/Pool.json")
const Market = require("../../artifacts/Market.json")
const Cafe = require("../../artifacts/Cafe.json")

const { deployContract } = require("ethereum-waffle")
const { Contract } = require("ethers")
const { expandTo18Decimals } = require("./utilities")

async function loadFixtures(provider, wallet) {
  const latte = await deployContract(wallet, Latte, [expandTo18Decimals(1000)])
  const weth = await deployContract(wallet, WETH, [])

  const factory = await deployContract(wallet, UniswapV2Factory, [wallet.address])
  const router = await deployContract(wallet, UniswapV2Router, [factory.address, weth.address], { gasLimit: 6000000 })

  await factory.createPair(latte.address, weth.address)
  const pairAddress = await factory.getPair(latte.address, weth.address)
  const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider).connect(wallet)

  const pricer = await deployContract(wallet, Pricer, [pair.address, latte.address])
  const shopper = await deployContract(wallet, Shopper, [latte.address, pricer.address])
  const pool = await deployContract(wallet, Pool, [latte.address, pricer.address])
  const market = await deployContract(wallet, Market, [latte.address, pool.address, router.address])
  const cafe = await deployContract(wallet, Cafe, [latte.address, pricer.address, shopper.address, pool.address])

  await latte.setCafe(cafe.address)
  await latte.setShopper(shopper.address);
  await latte.setPricer(pricer.address);
  await latte.setPool(pool.address);

  await pool.setMarket(market.address);

  return { latte, router, pair, pricer, shopper, pool, market, cafe }
}


module.exports = {
  loadFixtures
}
