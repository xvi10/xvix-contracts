const { deployContract } = require("./helpers")

async function main() {
  const xvix = { address: "0x4bAE380B5D762D543d426331b8437926443ae9ec" }
  const gov = await deployContract("Gov", [xvix.address, 1619049600])
  return { gov }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
