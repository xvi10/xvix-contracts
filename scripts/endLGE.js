const { sendTxn, contractAt } = require("./helpers")

async function main() {
  const distributor = await contractAt("Distributor", "0x144A32B2A0c77E81a9bC206BaA0964e2603a3CAD")
  const deadline = parseInt(Date.now() / 1000) + 20 * 60
  await sendTxn(distributor.endLGE(deadline), "distributor.endLGE")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
