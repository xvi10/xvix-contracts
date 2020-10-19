const { increaseTime } = require("./utilities")
const { addLiquidityETH, buyTokens, sellTokens } = require("./uniswap")

async function increasePrice({ provider, router, wallet, latte, weth, amountToken, amountETH, buyAmount }) {
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })

    await buyTokens({ router, wallet, weth, token: latte, amount: buyAmount })
    await buyTokens({ router, wallet, weth, token: latte, amount: buyAmount })

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amount: buyAmount })
    await buyTokens({ router, wallet, weth, token: latte, amount: buyAmount })

    await increaseTime(provider, 40 * 60)
    await buyTokens({ router, wallet, weth, token: latte, amount: buyAmount })
    await buyTokens({ router, wallet, weth, token: latte, amount: buyAmount })
}

async function decreasePrice({ provider, router, wallet, latte, weth, amountToken, amountETH, sellAmount }) {
    await addLiquidityETH({ router, wallet, token: latte, amountToken, amountETH })

    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })

    await increaseTime(provider, 40 * 60)
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })
    await sellTokens({ router, wallet, weth, token: latte, amount: sellAmount })
}

module.exports = {
  increasePrice,
  decreasePrice
}
