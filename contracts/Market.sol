//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/IPool.sol";
import "./interfaces/IUniswapV2Router.sol";

contract Market {
    using SafeMath for uint256;

    address public immutable latte;
    address public immutable pool;
    address public immutable uniswapRouter;

    constructor(address _latte, address _pool, address _uniswapRouter) public {
        latte = _latte;
        pool = _pool;
        uniswapRouter = _uniswapRouter;
    }

    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == latte, "Market: path does not end with latte");
        amounts = IUniswapV2Router(uniswapRouter).swapExactETHForTokens{value: msg.value}(amountOutMin, path, to, deadline);
        uint256 amount = amounts[amounts.length - 1];
        IPool(pool).mint(msg.sender, amount);
    }

    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == latte, "Market: path does not end with latte");
        amounts = IUniswapV2Router(uniswapRouter).swapETHForExactTokens{value: msg.value}(amountOut, path, to, deadline);
        uint256 amount = amounts[amounts.length - 1];
        IPool(pool).mint(msg.sender, amount);

        if (msg.value > amounts[0]) {
            (bool success,) = msg.sender.call{value: msg.value.sub(amounts[0])}("");
            require(success, "Market: transfer failed");
        }
    }

    receive() external payable {}
}
