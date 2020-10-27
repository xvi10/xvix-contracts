//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPool.sol";


contract Distribution is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant LP_BASIS_POINTS = 1000; // 10%
    uint256 public constant FUND_BASIS_POINTS = 2000; // 20%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    address public immutable latte;
    address public immutable pool;
    address public immutable lp; // liquidity provider
    address public immutable fund; // marketing / dev fund
    address public immutable gov;

    uint256 public ethDivisor;
    uint256 public tokenMultiplier;

    uint256 public ethReceived;
    uint256 public ethCap;

    bool public active = true;

    event Mint(address indexed to, uint256 value);

    constructor(address _latte, address _pool, address _lp, address _fund, uint256 _ethDivisor, uint256 _tokenMultiplier, uint256 _ethCap) public {
        latte = _latte;
        pool = _pool;
        lp = _lp;
        fund = _fund;
        ethDivisor = _ethDivisor;
        tokenMultiplier = _tokenMultiplier;
        ethCap = _ethCap;
        gov = msg.sender;
    }

    function end() external {
        require(msg.sender == gov, "Distribution: forbidden");
        active = false;
    }

    function mint(address receiver) external payable nonReentrant {
        require(active, "Distribution: not active");
        require(msg.value > 0, "Distribution: insufficient value in");

        uint256 receiverTokens = getMintAmount(msg.value);
        require(receiverTokens > 0, "Distribution: mint amount is zero");
        ILatte(latte).mint(receiver, receiverTokens);

        uint256 lpTokens = receiverTokens.mul(LP_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        ILatte(latte).mint(lp, lpTokens);

        uint256 lpETH = msg.value.mul(LP_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);

        (bool success,) = lp.call{value: lpETH}("");
        require(success, "Distribution: transfer to lp failed");

        uint256 fundETH = msg.value.mul(FUND_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        (success,) = fund.call{value: fundETH}("");
        require(success, "Distribution: transfer to fund failed");

        uint256 poolETH = msg.value.sub(lpETH).sub(fundETH);
        IPool(pool).fund{value: poolETH}();

        ethReceived = ethReceived.add(msg.value);
        require(ethReceived > ethCap, "Distribution: cap reached");

        emit Mint(receiver, msg.value);
    }

    function getMintAmount(uint256 _ethAmount) public view returns (uint256) {
        return _ethAmount.mul(tokenMultiplier).div(ethDivisor);
    }
}
