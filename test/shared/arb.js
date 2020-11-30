const BigNumber = require("bignumber.js")
const { bigNumberify } = require("./utilities")

function bn(number) {
  return new BigNumber(number.toString())
}

// i: input pool params
// n: output pool params
function getArbComponents({ xi, yi, xn, yn }) {
  xi = bn(xi)
  yi = bn(yi)
  xn = bn(xn)
  yn = bn(yn)

  // m = sqrt((xi * yi) / (xn * yn))
  const m = ((xi.multipliedBy(yi)).dividedBy(xn.multipliedBy(yn))).squareRoot()
  // dy = (yi - m * yn) / (m + 1)
  const dy = (yi.minus(m.multipliedBy(yn))).dividedBy(m.plus(bn(1)))
  // dxi = (xi * dy) / (yi - dy)
  const dxi = (xi.multipliedBy(dy)).dividedBy(yi.minus(dy))
  // dxn = (xn * dy) / (yn + dy)
  const dxn = (xn.multipliedBy(dy)).dividedBy(yn.plus(dy))

  if (dy.isNegative() && dxi.isNegative() && dxn.isNegative()) {
    return {
      dy: bigNumberify(0),
      dxi: bigNumberify(0),
      dxn: bigNumberify(0)
    }
  }

  return {
    dy: bigNumberify(dy.toFixed(0).toString()),
    dxi: bigNumberify(dxi.toFixed(0).toString()),
    dxn: bigNumberify(dxn.toFixed(0).toString())
  }
}

async function getMinterArbComponents({ minter, weth, xvix, pair }) {
  const xi = await minter.ethReserve()
  const yi = await minter.tokenReserve()
  const xn = await weth.balanceOf(pair.address)
  const yn = await xvix.balanceOf(pair.address)
  return getArbComponents({ xi, yi, xn, yn })
}

module.exports = {
  getArbComponents,
  getMinterArbComponents
}
