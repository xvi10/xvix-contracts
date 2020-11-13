const { expandDecimals } = require("../test/shared/utilities")
const { deployContract, contractAt } = require("./helpers")

async function main() {
  const lp = "0x28dC5a6e99d4e46B8862237d41BA894Bf411Bf66"
  const fund = "0x55817f4a616a77af8A47FD63109Bb002EbF12F3a"

  const initialSupply = expandDecimals(0, 18)
  const distributionMaxSupply = expandDecimals(150000, 18)
  const minterMaxSupply = expandDecimals(150000, 18)

  const maxSupply = distributionMaxSupply.add(minterMaxSupply)
  const xvix = await deployContract("XVIX", [initialSupply, maxSupply])
  const weth = await contractAt("WETH", "0xc778417e063141139fce010982780140aa0cd5ab")

  const factory = await contractAt("UniswapV2Factory", "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f")
  const router = await contractAt("UniswapV2Router", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D")

  const txn = await factory.createPair(xvix.address, weth.address)
  await txn.wait()
  console.log("Pair created", txn.hash)
  const pairAddress = await factory.getPair(xvix.address, weth.address)
  const pair = await contractAt("UniswapV2Pair", pairAddress)
  console.log("Deployed pair to " + pair.address)

  const floor = await deployContract("Floor", [xvix.address])
  const market = await deployContract("Market", [weth.address, factory.address])
  const minter = await deployContract("Minter", [xvix.address, floor.address, minterMaxSupply])
  const distributor = await deployContract("Distributor", [xvix.address, floor.address, lp, fund, 100, 1, expandDecimals(1500, 18), expandDecimals(500, 18), expandDecimals(10, 18)])

  await xvix.setMinter(minter.address)
  await xvix.setFloor(floor.address)
  await xvix.setDistributor(distributor.address)

  await xvix.addExemption(pair.address)
  await xvix.addExemption(market.address)

  return { xvix, weth, router, pair, floor, market, minter, distributor, lp, fund }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
