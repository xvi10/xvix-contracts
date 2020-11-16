const { getBlockTime } = require("./utilities")

async function getRebaseTime(provider, xvix, intervals) {
  const blockTime = await getBlockTime(provider)
  const nextRebaseTime = await xvix.nextRebaseTime()
  const rebaseInterval = await xvix.rebaseInterval()
  const targetTime = nextRebaseTime.toNumber() + intervals * rebaseInterval
  return targetTime - blockTime - 10 // reduce by 10 for some buffer
}

module.exports = {
  getRebaseTime
}
