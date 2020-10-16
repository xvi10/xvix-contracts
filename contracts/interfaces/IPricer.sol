// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface IPricer {
    function update() external returns (bool);
    function lastPrice() external view returns (uint224);
    function hasIncreasingPrice() external view returns (bool);
    function hasDecreasingPrice() external view returns (bool);
    function tokensForEth(uint256 amountIn) external view returns (uint256);
    function ethForTokens(uint256 amountIn) external view returns (uint256);
}
