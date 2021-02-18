const { deployContract } = require("./helpers")

async function main() {
  const reader = await deployContract("InfoReader", [])
  return { reader }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
