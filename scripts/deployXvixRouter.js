const { deployContract, contractAt, sendTxn } = require("./helpers")

async function main() {
  const factory = { address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" }
  const weth = { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" }
  const uniFarm = { address: "0x8A3d7A49ADa4FED00d83fA6827F46F83b62eF87F" }
  const xvix = await contractAt("XVIX", "0x4bAE380B5D762D543d426331b8437926443ae9ec")
  const router = await deployContract("XvixRouter", [factory.address, weth.address, uniFarm.address])
  await sendTxn(xvix.createSafe(router.address), "xvix.createSafe")
  await sendTxn(xvix.setTransferConfig(router.address, 0, 0, 0, 0), "xvix.setTransferConfig")

  return { router }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
