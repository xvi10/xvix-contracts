const { sendTxn, contractAt } = require("./helpers")

async function main() {
  const provider = waffle.provider
  const accounts = await provider.listAccounts()
  const fund = { address: accounts[0] }
  const xvix = await contractAt("XVIX", "0xD7093836CB7e3bF62F8C8ebffcFe0BABCC606484")
  const distributor = await contractAt("Distributor", "0xFf80AEd5dF0d84403A9B2c9e5F9Dd3Dc5444C43a")
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
