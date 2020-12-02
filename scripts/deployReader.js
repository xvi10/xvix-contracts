const { deployContract } = require("./helpers")

async function main() {
  const factory = { address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" }
  const xvix = { address: "0x4bAE380B5D762D543d426331b8437926443ae9ec" }
  const dai = { address: "0x6b175474e89094c44da98b954eedeac495271d0f" }
  const lgeTokenWETH = { address: "0xc278a41fc6cf7f488aea2d0ab321cc77128931d5" }
  const distributor = { address: "0x2b35cccd8a0bdd17ec2f7e28d8929723826f13d5" }
  const floor = { address: "0x40ed3699c2ffe43939ecf2f3d11f633b522820ad" }
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
