async function send(provider, method, params = []) {
  await provider.send(method, params)
}

async function mineBlock(provider) {
  await send(provider, 'evm_mine')
}

async function increaseTime(provider, seconds) {
  await send(provider, 'evm_increaseTime', [seconds])
}

module.exports = {
  mineBlock,
  increaseTime
}
