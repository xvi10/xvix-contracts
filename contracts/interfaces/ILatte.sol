// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface ILatte {
    function supplySnapshot() external view returns (uint256);
    function snapshotTime() external view returns (uint256);
    function mint(address account, uint256 amount) external returns (bool);
    function burn(address account, uint256 amount) external returns (bool);
}
