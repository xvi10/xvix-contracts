const { sendTxn, contractAt } = require("./helpers")

async function main() {
  const provider = waffle.provider
  const accounts = await provider.listAccounts()
  const fund = { address: accounts[0] }
  const xvix = await contractAt("XVIX", "0x61f1D54EeF55A54D4826B79E33fCf370488813e4")
  const distributor = await contractAt("Distributor", "0x5bf22F4473b0e2f96eb567a1BDf828012db2e2CB")
  const deadline = parseInt(Date.now() / 1000) + 20 * 60
  await sendTxn(distributor.endLGE(deadline), "distributor.endLGE")
  await sendTxn(xvix.setFund(fund.address), "xvix.setFund")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
