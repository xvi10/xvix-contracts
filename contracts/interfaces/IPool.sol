// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface IPool {
    function fund() external payable;
    function mint(address recipient, uint256 amount) external;
    function revokeShares(address account) external;
}
