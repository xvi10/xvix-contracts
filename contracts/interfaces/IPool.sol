// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface IPool {
    function fund() external payable;
    function burn(address account) external;
    function mint(address recipient, uint256 amount) external;
}
