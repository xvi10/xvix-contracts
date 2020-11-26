//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

contract Fund {
    using SafeMath for uint256;

    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant FEE_SPLIT = 9000;

    address public receiverA;
    address public receiverB;

    constructor(address _receiverA, address _receiverB) public {
        receiverA = _receiverA;
        receiverB = _receiverB;
    }

    function setReceiverA(address _receiverA) public {
        require(msg.sender == receiverA, "Fund: forbidden");
        receiverA = _receiverA;
    }

    function setReceiverB(address _receiverB) public {
        require(msg.sender == receiverB, "Fund: forbidden");
        receiverB = _receiverB;
    }

    function split(address _token, uint256 _amount) public {
        require(msg.sender == receiverA || msg.sender == receiverB, "Fund: forbidden");
        uint256 amountA = _amount.mul(FEE_SPLIT).div(BASIS_POINTS_DIVISOR);
        uint256 amountB = _amount.sub(amountA);
        IERC20(_token).transfer(receiverA, amountA);
        IERC20(_token).transfer(receiverB, amountB);
    }
}
