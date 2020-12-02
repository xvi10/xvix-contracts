const { sendTxn, contractAt } = require("./helpers")

async function main() {
  const provider = waffle.provider
  const accounts = await provider.listAccounts()
  const fund = { address: accounts[0] }
  const xvix = await contractAt("XVIX", "0x4bAE380B5D762D543d426331b8437926443ae9ec")
  const distributor = await contractAt("Distributor", "0x2b35cCCD8A0BdD17EC2F7e28D8929723826F13D5")
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
