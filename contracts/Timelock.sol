// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/token/IERC20.sol";

contract Timelock {
    address public token;
    address public receiver;
    uint256 public releaseTime;
    address public gov;

    constructor (address _token, address _receiver, uint256 _releaseTime) public {
        token = _token;
        receiver = _receiver;
        releaseTime = _releaseTime;
        gov = msg.sender;
    }

    function setGov(address _gov) external {
        require(msg.sender == gov, "Timelock: forbidden");
        gov = _gov;
    }

    function setReceiver(address _receiver) external {
        require(msg.sender == gov, "Timelock: forbidden");
        receiver = _receiver;
    }

    function release(uint256 _amount) public virtual {
        require(msg.sender == gov, "Timelock: forbidden");
        require(block.timestamp >= releaseTime, "Timelock: release time not yet reached");

        IERC20(token).transfer(receiver, _amount);
    }
}
