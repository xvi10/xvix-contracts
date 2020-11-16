//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/IFloor.sol";
import "./interfaces/IXVIX.sol";


contract Floor is IFloor, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant REFUND_BASIS_POINTS = 9000; // 90%

    address public immutable xvix;
    // manually track capital to guard against reentrancy attacks
    uint256 public override capital;

    event Refund(address indexed to, uint256 refundAmount, uint256 burnAmount);
    event FloorPrice(uint256 capital, uint256 supply);

    constructor(address _xvix) public {
        xvix = _xvix;
    }

    receive() external payable nonReentrant {
        capital = capital.add(msg.value);
    }

    function refund(address _receiver, uint256 _burnAmount) external override nonReentrant returns (uint256) {
        uint256 refundAmount = getRefundAmount(_burnAmount);
        require(refundAmount > 0, "Floor: refund amount is zero");
        capital = capital.sub(refundAmount);

        IXVIX(xvix).burn(msg.sender, _burnAmount);

        (bool success,) = _receiver.call{value: refundAmount}("");
        require(success, "Floor: transfer to reciever failed");

        emit Refund(_receiver, refundAmount, _burnAmount);
        emit FloorPrice(capital, IERC20(xvix).totalSupply());

        return refundAmount;
    }

    function getMaxMintAmount(uint256 _ethAmount) external override view returns (uint256) {
        if (capital == 0) {
            return 0;
        }
        uint256 totalSupply = IERC20(xvix).totalSupply();
        return _ethAmount.mul(totalSupply).div(capital);
    }

    function getRefundAmount(uint256 _tokenAmount) public view returns (uint256) {
        uint256 totalSupply = IERC20(xvix).totalSupply();
        if (_tokenAmount == totalSupply) {
            return capital;
        }

        uint256 amount = capital.mul(_tokenAmount).div(totalSupply);
        return amount.mul(REFUND_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
    }
}