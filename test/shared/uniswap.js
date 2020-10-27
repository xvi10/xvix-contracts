async function addLiquidityETH({ router, wallet, token, tokenAmount, ethAmount }) {
  await token.approve(router.address, tokenAmount)
  return router.connect(wallet).addLiquidityETH(
    token.address,
    tokenAmount,
    tokenAmount,
    ethAmount,
    wallet.address,
    ethers.constants.MaxUint256,
    { value: ethAmount }
  )
}

async function removeLiquidityETH({ router, wallet, token, liquidity }) {
  return router.connect(wallet).removeLiquidityETH(
    token.address,
    liquidity,
    0,
    0,
    wallet.address,
    ethers.constants.MaxUint256
  )
}

async function buyTokens({ router, wallet, weth, token, ethAmount }) {
  return router.connect(wallet).swapExactETHForTokens(
    0,
    [weth.address, token.address],
    wallet.address,
    ethers.constants.MaxUint256,
    { value: ethAmount }
  )
}

async function sellTokens({ router, wallet, weth, token, tokenAmount }) {
  await token.approve(router.address, tokenAmount)
  return router.connect(wallet).swapExactTokensForETH(
    tokenAmount,
    0,
    [token.address, weth.address],
    wallet.address,
    ethers.constants.MaxUint256
  )
}

module.exports = {
  addLiquidityETH,
  removeLiquidityETH,
  buyTokens,
  sellTokens
}
