const { expandDecimals } = require("../test/shared/utilities")
const { deployContract, contractAt } = require("./helpers")

async function main() {
  const lp = "0x28dC5a6e99d4e46B8862237d41BA894Bf411Bf66"
  const fund = "0x55817f4a616a77af8A47FD63109Bb002EbF12F3a"

  const initialSupply = expandDecimals(0, 18)
  const distributionMaxSupply = expandDecimals(150000, 18)
  const cafeMaxSupply = expandDecimals(150000, 18)

  const maxSupply = distributionMaxSupply.add(cafeMaxSupply)
  const latte = await deployContract("Latte", [initialSupply, maxSupply])
  const weth = await contractAt("WETH", "0xc778417e063141139fce010982780140aa0cd5ab")

  const factory = await contractAt("UniswapV2Factory", "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f")
  const router = await contractAt("UniswapV2Router", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D")

  const txn = await factory.createPair(latte.address, weth.address)
  await txn.wait()
  console.log("Pair created", txn.hash)
  const pairAddress = await factory.getPair(latte.address, weth.address)
  const pair = await contractAt("UniswapV2Pair", pairAddress)
  console.log("Deployed pair to " + pair.address)

  const pool = await deployContract("Pool", [latte.address])
  const market = await deployContract("Market", [weth.address, factory.address])
  const cafe = await deployContract("Cafe", [latte.address, pool.address, cafeMaxSupply])
  const distributor = await deployContract("Distributor", [latte.address, pool.address, lp, fund, 100, 1, expandDecimals(1500, 18), expandDecimals(500, 18), expandDecimals(10, 18)])

  await latte.setCafe(cafe.address)
  await latte.setPool(pool.address)
  await latte.setDistributor(distributor.address)

  await latte.addExemption(pair.address)
  await latte.addExemption(market.address)

  return { latte, weth, router, pair, pool, market, cafe, distributor, lp, fund }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
