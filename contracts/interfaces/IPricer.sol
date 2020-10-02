// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface IPricer {
    function update() external returns (bool);
    function hasIncreasingPrice() external view returns (bool);
    function hasDecreasingPrice() external view returns (bool);
}
