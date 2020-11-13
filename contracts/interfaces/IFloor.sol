// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IFloor {
    function refund(address receiver, uint256 burnAmount) external returns (uint256);
    function capital() external view returns (uint256);
    function getMintAmount(uint256 ethAmount) external view returns (uint256);
}
