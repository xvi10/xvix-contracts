const { deployContract } = require("./helpers")

async function main() {
  const poolToken1 = { address: "0x619aaa52a10f196e521f823aed4cdea30d45d366" } // XVIX/ETH Uniswap
  const poolToken2 = { address: "0x232ae3b131e78273f475f4827db83d19f9badbae" } // XVIX/DAI Uniswap
  const poolToken3 = { address: "0xC278A41fC6cf7F488AEa2D0Ab321CC77128931D5" } // XLGE:ETH
  const poolToken4 = { address: "0x4E2249c1458f12C664fCFDf74fB1490b454c9327" } // XLGE:DAI

  const rewardToken = { address: "0x4bAE380B5D762D543d426331b8437926443ae9ec" } // XVIX
  const pool1 = await deployContract("Farm", ["XVIX/ETH UNI", poolToken1.address, rewardToken.address])
  const pool2 = await deployContract("Farm", ["XVIX/DAI UNI", poolToken2.address, rewardToken.address])
  const pool3 = await deployContract("Farm", ["XLGE:ETH", poolToken3.address, rewardToken.address])
  const pool4 = await deployContract("Farm", ["XLGE:DAI", poolToken4.address, rewardToken.address])

  return { pool1, pool2, pool3, pool4 }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
