const { expect } = require("chai")
const { getBlockTime } = require("./utilities")

async function getRebaseTime(provider, xvix, intervals) {
  const blockTime = await getBlockTime(provider)
  const nextRebaseTime = await xvix.nextRebaseTime()
  const rebaseInterval = await xvix.rebaseInterval()
  const targetTime = nextRebaseTime.toNumber() + intervals * rebaseInterval
  return targetTime - blockTime - 10 // reduce by 10 for some buffer
}

async function expectTransferConfig(
  xvix, msgSender, senderBurnBasisPoints, senderFundBasisPoints,
  receiverBurnBasisPoints, receiverFundBasisPoints
) {
  const config = await xvix.transferConfigs(msgSender)
  expect(config.senderBurnBasisPoints, senderBurnBasisPoints)
  expect(config.senderFundBasisPoints, senderFundBasisPoints)
  expect(config.receiverBurnBasisPoints, receiverBurnBasisPoints)
  expect(config.receiverFundBasisPoints, receiverFundBasisPoints)
}

module.exports = {
  getRebaseTime,
  expectTransferConfig
}
