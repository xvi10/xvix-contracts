function bigNumberify(n) {
  return ethers.BigNumber.from(n)
}

function expandTo18Decimals(n) {
  return bigNumberify(n).mul(bigNumberify(10).pow(18))
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

module.exports = {
  bigNumberify,
  expandTo18Decimals,
  mineBlock,
  increaseTime
}
