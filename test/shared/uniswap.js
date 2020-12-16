async function addLiquidityETH({ router, wallet, token, tokenAmount, ethAmount }) {
  await token.connect(wallet).approve(router.address, tokenAmount)
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

async function removeLiquidityETH({ router, wallet, receiver, token, liquidity }) {
  return router.connect(wallet).removeLiquidityETH(
    token.address,
    liquidity,
    0,
    0,
    receiver.address,
    ethers.constants.MaxUint256
  )
}

async function removeLiquidityETHWithFee({ router, wallet, receiver, token, liquidity }) {
  return router.connect(wallet).removeLiquidityETHSupportingFeeOnTransferTokens(
    token.address,
    liquidity,
    0,
    0,
    receiver.address,
    ethers.constants.MaxUint256
  )
}

async function buyTokens({ router, wallet, receiver, weth, token, ethAmount }) {
  return router.connect(wallet).swapExactETHForTokens(
    0,
    [weth.address, token.address],
    receiver.address,
    ethers.constants.MaxUint256,
    { value: ethAmount }
  )
}

async function buyTokensWithFee({ router, wallet, receiver, weth, token, ethAmount }) {
  return router.connect(wallet).swapExactETHForTokensSupportingFeeOnTransferTokens(
    0,
    [weth.address, token.address],
    receiver.address,
    ethers.constants.MaxUint256,
    { value: ethAmount }
  )
}

async function sellTokens({ router, wallet, receiver, weth, token, tokenAmount }) {
  await token.connect(wallet).approve(router.address, tokenAmount)
  return router.connect(wallet).swapExactTokensForETH(
    tokenAmount,
    0,
    [token.address, weth.address],
    receiver.address,
    ethers.constants.MaxUint256
  )
}

async function sellTokensWithFee({ router, wallet, receiver, weth, token, tokenAmount }) {
  await token.connect(wallet).approve(router.address, tokenAmount)
  return router.connect(wallet).swapExactTokensForETHSupportingFeeOnTransferTokens(
    tokenAmount,
    0,
    [token.address, weth.address],
    receiver.address,
    ethers.constants.MaxUint256
  )
}

module.exports = {
  addLiquidityETH,
  removeLiquidityETH,
  removeLiquidityETHWithFee,
  buyTokens,
  buyTokensWithFee,
  sellTokens,
  sellTokensWithFee
}
