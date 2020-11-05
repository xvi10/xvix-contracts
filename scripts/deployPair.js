const { expandDecimals } = require("../test/shared/utilities")
const { deployContract, contractAt } = require("./helpers")

async function main(tokenAddress) {
  const latte = await contractAt("Latte", "0x454D460193DfF166c4DDb9f98184eD9F9ABa0336")
  const factory = await contractAt("UniswapV2Factory", "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f")

  const txn = await factory.createPair(latte.address, tokenAddress)
  await txn.wait()
  console.log("Pair created", txn.hash)
  const pairAddress = await factory.getPair(latte.address, tokenAddress)
  const pair = await contractAt("UniswapV2Pair", pairAddress)
  console.log("Deployed pair to " + pair.address)

  await latte.addExemption(pair.address)

  return { latte, pair }
}

main("0xad6d458402f60fd3bd25163575031acdce07538d")
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
