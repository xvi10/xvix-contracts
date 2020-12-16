//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./interfaces/IFarmDistributor.sol";

contract FarmDistributor is IFarmDistributor {
    using SafeMath for uint256;

    receive() external payable {}

    function distribute(address farm) external override {
        uint256 amount = address(this).balance;
        if (amount == 0) { return; }
        (bool success,) = farm.call{value: amount}("");
        require(success, "FarmDistributor: distribution transfer failed");
    }
}
