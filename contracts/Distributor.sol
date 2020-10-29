//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPool.sol";
import "@nomiclabs/buidler/console.sol";


contract Distributor is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant LP_BASIS_POINTS = 2000; // 20%
    uint256 public constant FUND_BASIS_POINTS = 2000; // 20%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    address public immutable latte;
    address public immutable pool;
    address public immutable lp; // liquidity provider
    address public fund; // marketing / dev fund
    address public immutable gov;

    uint256 public divisor;
    uint256 public multiplier;

    uint256 public ethReceived;
    uint256 public ethMaxCap;
    uint256 public ethSoftCap;

    bool public active = true;

    event Mint(address indexed to, uint256 value);

    constructor(address _latte, address _pool, address _lp, address _fund, uint256 _multiplier, uint256 _divisor, uint256 _ethMaxCap, uint256 _ethSoftCap) public {
        latte = _latte;
        pool = _pool;
        lp = _lp;
        fund = _fund;
        multiplier = _multiplier;
        divisor = _divisor;
        ethMaxCap = _ethMaxCap;
        ethSoftCap = _ethSoftCap;
        gov = msg.sender;
    }

    function stop() external {
        require(msg.sender == gov, "Distributor: forbidden");
        active = false;
    }

    function setSoftCap(uint256 _ethSoftCap) external {
        require(msg.sender == gov, "Distributor: forbidden");
        require(_ethSoftCap <= ethMaxCap, "Distributor: cannot exceed max cap");
        ethSoftCap = _ethSoftCap;
    }

    function setFund(address _fund) external {
        require(msg.sender == gov, "Distributor: forbidden");
        fund = _fund;
    }

    function mint(address receiver) external payable nonReentrant {
        require(active, "Distributor: not active");
        require(msg.value > 0, "Distributor: insufficient value");

        uint256 receiverTokens = getMintAmount(msg.value);
        require(receiverTokens > 0, "Distributor: mint amount is zero");
        ILatte(latte).mint(receiver, receiverTokens);

        uint256 lpTokens = receiverTokens.mul(LP_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        ILatte(latte).mint(lp, lpTokens);

        uint256 lpETH = msg.value.mul(LP_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);

        (bool success,) = lp.call{value: lpETH}("");
        require(success, "Distributor: transfer to lp failed");

        uint256 fundETH = msg.value.mul(FUND_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        (success,) = fund.call{value: fundETH}("");
        require(success, "Distributor: transfer to fund failed");

        uint256 poolETH = msg.value.sub(lpETH).sub(fundETH);
        (success,) = pool.call{value: poolETH}("");
        require(success, "Distributor: transfer to pool failed");

        ethReceived = ethReceived.add(msg.value);
        require(ethReceived <= ethSoftCap, "Distributor: cap reached");

        emit Mint(receiver, msg.value);
    }

    function getMintAmount(uint256 _ethAmount) public view returns (uint256) {
        return _ethAmount.mul(multiplier).div(divisor);
    }
}
