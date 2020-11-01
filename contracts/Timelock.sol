// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/token/IERC20.sol";

contract Timelock {
    uint256 public releaseTime;
    address public gov;

    constructor (uint256 _releaseTime) public {
        releaseTime = _releaseTime;
        gov = msg.sender;
    }

    function setGov(address _gov) external {
        require(msg.sender == gov, "Timelock: forbidden");
        gov = _gov;
    }

    function release(address _receiver, address _token, uint256 _amount) public virtual {
        require(msg.sender == gov, "Timelock: forbidden");
        require(block.timestamp >= releaseTime, "Timelock: release time not yet reached");

        IERC20(_token).transfer(_receiver, _amount);
    }
}
