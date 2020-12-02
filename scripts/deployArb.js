const { deployContract } = require("./helpers")

async function main() {
  const xvix = { address: "0x4bAE380B5D762D543d426331b8437926443ae9ec" }
  const weth = { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" }
  const minter = { address: "0x452dceFd77ee4CC41373CC1a3207d8969f1C21B2" }
  const floor = { address: "0x40ED3699C2fFe43939ecf2F3d11F633b522820aD" }
  const router = { address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" }
  const receiver = { address: "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8" }
  const lendingPoolAddressesProvider = { address: "0x24a42fD28C976A61Df5D00D0599C34c4f90748c8" }
  const arb = await deployContract("Arb", [xvix.address, weth.address, minter.address,
    floor.address, router.address, receiver.address, lendingPoolAddressesProvider.address])

  return { arb }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
