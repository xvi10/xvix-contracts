const { sendTxn, contractAt } = require("./helpers")

async function main() {
  const provider = waffle.provider
  const accounts = await provider.listAccounts()
  const receiver = accounts[0]
  const minter = await contractAt("Minter", "0xEa8301EfE28D4474DDb985aDB2FcA70a11543516")
  await sendTxn(minter.mint(receiver, { value: "100000000000000" }), "minter.mint") // 0.0001 ETH
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
