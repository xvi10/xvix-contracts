// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface ILatte {
    function totalSupply() external view returns (uint256);
    function supplySnapshot() external view returns (uint256);
    function mint(address account, uint256 amount) external returns (bool);
}
