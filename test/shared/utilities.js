function bigNumberify(n) {
  return ethers.BigNumber.from(n)
}

function expandDecimals(n, decimals) {
  return bigNumberify(n).mul(bigNumberify(10).pow(decimals))
}

async function send(provider, method, params = []) {
  await provider.send(method, params)
}

async function mineBlock(provider) {
  await send(provider, "evm_mine")
}

async function increaseTime(provider, seconds) {
  await send(provider, "evm_increaseTime", [seconds])
}

async function gasUsed(provider, tx) {
  return (await provider.getTransactionReceipt(tx.hash)).gasUsed
}

async function getBlockTime(provider) {
  const blockNumber = await provider.getBlockNumber()
  const block = await provider.getBlock(blockNumber)
  return block.timestamp
}

async function getLatestSlot(provider) {
  const blockTime = await getBlockTime(provider)
  const interval = 7 * 24 * 60 * 60
  return parseInt(blockTime / interval)
}

module.exports = {
  bigNumberify,
  expandDecimals,
  mineBlock,
  increaseTime,
  gasUsed,
  getBlockTime,
  getLatestSlot
}
