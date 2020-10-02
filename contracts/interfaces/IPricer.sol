// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface IPricer {
    function updatePrice() external returns (bool);
    function hasIncreasingPrice() external view returns (bool);
    function hasDecreasingPrice() external view returns (bool);
    // returns number of tokens to mint for a given amount of ETH
    function getMintAmount(uint256 value) external view returns (uint256);
}
