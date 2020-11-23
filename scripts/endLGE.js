const { sendTxn, contractAt } = require("./helpers")

async function main() {
  const distributor = await contractAt("Distributor", "0x5bf22F4473b0e2f96eb567a1BDf828012db2e2CB")
  const deadline = parseInt(Date.now() / 1000) + 20 * 60
  await sendTxn(distributor.endLGE(deadline), "distributor.endLGE")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
