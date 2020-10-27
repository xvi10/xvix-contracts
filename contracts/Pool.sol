//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/IPool.sol";
import "./interfaces/ILatte.sol";


contract Pool is IPool, ReentrancyGuard {
    using SafeMath for uint256;

    address public immutable latte;
    uint256 public override capital;

    event Refund(address indexed to, uint256 refundAmount, uint256 burnAmount);

    constructor(address _latte) public {
        latte = _latte;
    }

    function fund() external override payable nonReentrant {
        capital = capital.add(msg.value);
    }

    function refund(address _receiver, uint256 _burnAmount) external nonReentrant {
        uint256 refundAmount = getRefundAmount(_burnAmount);
        capital = capital.sub(refundAmount);

        ILatte(latte).burn(msg.sender, _burnAmount);

        (bool success,) = _receiver.call{value: refundAmount}("");
        require(success, "Pool: transfer to reciever failed");

        emit Refund(_receiver, refundAmount, _burnAmount);
    }

    function getRefundAmount(uint256 _amount) public view returns (uint256) {
        uint256 totalSupply = IERC20(latte).totalSupply();
        return capital.mul(_amount).div(totalSupply);
    }
}
