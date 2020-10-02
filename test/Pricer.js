const { expect, use } = require("chai")
const { deployContract, MockProvider, solidity } = require("ethereum-waffle")

const Pricer = require("../artifacts/Pricer.json")

use(solidity)

describe("Pricer", function() {
  it("Should return the price", async function() {
    const [wallet] = new MockProvider().getWallets();
    const pricer = await deployContract(wallet, Pricer, [wallet.address])
    const price = await pricer.price()
    const divisor = ethers.BigNumber.from(10).pow(18)
    console.log("price", price.toString())
  })
})
