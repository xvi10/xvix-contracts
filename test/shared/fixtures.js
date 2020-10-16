const WETH = require("../../artifacts/WETH.json")
const UniswapV2Pair = require("../../artifacts/UniswapV2Pair.json")
const UniswapV2Factory = require("../../artifacts/UniswapV2Factory.json")
const UniswapV2Router = require("../../artifacts/UniswapV2Router.json")
const Latte = require("../../artifacts/Latte.json")

const { deployContract } = require("ethereum-waffle")
const { Contract } = require("ethers")
const { expandDecimals } = require("./utilities")

async function loadFixtures(provider, wallet) {
  const latte = await deployContract(wallet, Latte, [expandDecimals(1000, 18)])
  const weth = await deployContract(wallet, WETH, [])

  const factory = await deployContract(wallet, UniswapV2Factory, [wallet.address])
  const router = await deployContract(wallet, UniswapV2Router, [factory.address, weth.address], { gasLimit: 6000000 })

  await factory.createPair(latte.address, weth.address)
  const pairAddress = await factory.getPair(latte.address, weth.address)
  const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider).connect(wallet)

  return { latte, router, pair }
}


module.exports = {
  loadFixtures
}
