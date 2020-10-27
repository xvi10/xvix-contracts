// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IPool {
    function capital() external view returns (uint256);
    function fund() external payable;
}
