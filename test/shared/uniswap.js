async function addLiquidityETH({ router, wallet, token, amountToken, amountETH }) {
  await token.approve(router.address, amountToken)
  return await router.addLiquidityETH(
    token.address,
    amountToken,
    amountToken,
    amountETH,
    wallet.address,
    ethers.constants.MaxUint256,
    { value: amountETH }
  )
}

async function buyTokens({ router, wallet, weth, token, amountETH }) {
  return await router.swapExactETHForTokens(
    0,
    [weth.address, token.address],
    wallet.address,
    ethers.constants.MaxUint256,
    { value: amountETH }
  )
}

async function sellTokens({ router, wallet, weth, token, amountToken }) {
  await token.approve(router.address, amountToken)
  return await router.swapExactTokensForETH(
    amountToken,
    0,
    [token.address, weth.address],
    wallet.address,
    ethers.constants.MaxUint256
  )
}

module.exports = {
  addLiquidityETH,
  buyTokens,
  sellTokens
}
