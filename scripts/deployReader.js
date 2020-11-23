const { deployContract } = require("./helpers")

async function main() {
  const factory = { address: "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f" }
  const xvix = { address: "0xF334c32efc584C05C0a37F0F3e83F7DEADf5a67E" }
  const dai = { address: "0xad6d458402f60fd3bd25163575031acdce07538d" }
  const lgeTokenWETH = { address: "0xa754a6147BAE56d21D09e0D34D7013F0C59a9d3d" }
  const distributor = { address: "0x144A32B2A0c77E81a9bC206BaA0964e2603a3CAD" }
  const floor = { address: "0x43880031953B3cF5142376bb46D6d9b5A90d684D" }
  const reader = await deployContract("Reader", [factory.address, xvix.address, dai.address,
    lgeTokenWETH.address, distributor.address, floor.address])

  return { reader }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
