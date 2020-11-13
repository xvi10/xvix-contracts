const { expect } = require("chai")
const { getBlockTime } = require("./utilities")

async function getLatestSlot(provider) {
  const blockTime = await getBlockTime(provider)
  const interval = 7 * 24 * 60 * 60
  return parseInt(blockTime / interval)
}

async function expectLedger(xvix, account, slot0, balance0, slot1, balance1) {
    const ledger = await xvix.ledgers(account)
    expect(ledger.slot0).eq(slot0)
    expect(ledger.balance0).eq(balance0)
    expect(ledger.slot1).eq(slot1)
    expect(ledger.balance1).eq(balance1)
}

module.exports = {
  getLatestSlot,
  expectLedger
}
