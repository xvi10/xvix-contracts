const { contractAt, sendTxn } = require("./helpers")

async function main() {
  const receivers = [
    "0x9c199c689493750d660ebcb1e5b48c3664f67362",
    "0x1a80e7c2e53ce52f4e6746749abbeaa902be5e2b",
    "0x2be665D046e518879519b5D17F61f4913FcC4490",
    "0x862c6f0373AC129fc66A324B234943139CA10c92"
  ]
  const feeBasisPoints = [
    6100,
    2900,
    500,
    500
  ]
  const fund = await contractAt("Fund", "0xd89119585c4612f2a31de9e9a6bb0513121ce7c3")
  await sendTxn(fund.setReceivers(receivers, feeBasisPoints), "fund.setReceivers")
  return { fund }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
