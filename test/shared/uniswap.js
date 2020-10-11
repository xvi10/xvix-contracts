async function addLiquidityETH({ router, wallet, token, amountToken, amountETH }) {
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
