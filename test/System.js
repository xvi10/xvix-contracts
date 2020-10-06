const { expect, use } = require("chai")
const { deployContract, MockProvider, solidity } = require("ethereum-waffle")

const Latte = require("../artifacts/Latte.json")

use(solidity)

describe("System", function() {
  it("deploy", async function() {
    const [wallet] = new MockProvider().getWallets();
    const latte = await deployContract(wallet, Latte, [wallet.address])
  })
})
