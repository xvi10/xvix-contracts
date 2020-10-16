async function addLiquidityETH({ router, wallet, token, amountToken, amountETH }) {
  await token.approve(router.address, amountToken)
  await router.addLiquidityETH(
    token.address,
    amountToken,
    amountToken,
    amountETH,
    wallet.address,
    ethers.constants.MaxUint256,
    { value: amountETH }
  )
}

module.exports = {
  addLiquidityETH
}
