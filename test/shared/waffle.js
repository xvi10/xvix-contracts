const { expect } = require("chai")

function expectBetween(result, min, max) {
  expect(result).gt(min)
  expect(result).lt(max)
}

module.exports = {
  expectBetween
}
