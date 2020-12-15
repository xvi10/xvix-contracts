const { deployContract, contractAt, sendTxn } = require("./helpers")

async function main() {
  const receiverA = { address: "0x9c199c689493750d660ebcb1e5b48c3664f67362" }
  const receiverB = { address: "0x1a80e7c2e53ce52f4e6746749abbeaa902be5e2b" }
  const receiverC = { address: "0x2be665D046e518879519b5D17F61f4913FcC4490" }
  const fund = await deployContract("Fund", [receiverA.address, receiverB.address, receiverC.address])
  const xvix = await contractAt("XVIX", "0x4bAE380B5D762D543d426331b8437926443ae9ec")
  await sendTxn(xvix.setFund(fund.address), "xvix.setFund")
  return { fund }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
