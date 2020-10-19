async function addLiquidityETH({ router, wallet, token, amountToken, amountETH }) {
  await token.approve(router.address, amountToken)
  return await router.connect(wallet).addLiquidityETH(
    token.address,
    amountToken,
    amountToken,
    amountETH,
    wallet.address,
    ethers.constants.MaxUint256,
    { value: amountETH }
  )
}

async function buyTokens({ router, wallet, weth, token, amount }) {
  return await router.connect(wallet).swapExactETHForTokens(
    0,
    [weth.address, token.address],
    wallet.address,
    ethers.constants.MaxUint256,
    { value: amount }
  )
}

async function sellTokens({ router, wallet, weth, token, amount }) {
  await token.approve(router.address, amount)
  return await router.connect(wallet).swapExactTokensForETH(
    amount,
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
