const { expandDecimals } = require("../test/shared/utilities")
const { deployContract, contractAt } = require("./helpers")

async function main() {
  const factory = await contractAt("UniswapV2Factory", "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f")
  const reader = await deployContract("Reader", [factory.address])

  return { factory, reader }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
