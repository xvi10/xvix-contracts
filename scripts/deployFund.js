const { deployContract, contractAt, sendTxn } = require("./helpers")

async function main() {
  const receivers = [
    "0x9c199c689493750d660ebcb1e5b48c3664f67362",
    "0x1a80e7c2e53ce52f4e6746749abbeaa902be5e2b",
    "0x2be665D046e518879519b5D17F61f4913FcC4490",
    "0x862c6f0373AC129fc66A324B234943139CA10c92"
  ]
  const feeBasisPoints = [
    6300,
    2900,
    500,
    300
  ]
  const xvix = await contractAt("XVIX", "0x4bAE380B5D762D543d426331b8437926443ae9ec")
  const fund = await deployContract("Fund", [xvix.address])
  await sendTxn(fund.setReceivers(receivers, feeBasisPoints), "fund.setReceivers")
  await sendTxn(xvix.setFund(fund.address), "xvix.setFund")
  return { fund }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
