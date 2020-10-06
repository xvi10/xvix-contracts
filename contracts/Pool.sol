//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/IPool.sol";

contract Pool is IPool {
    using SafeMath for uint256;

    uint256 public constant MIN_INTERVAL = 24 hours;
    uint256 public constant REWARDS_BASIS_POINTS = 100;
    uint256 public constant BONUS_REWARD_INTERVAL = 7 days;
    uint256 public constant BONUS_REWARD_BASIS_POINTS = 5000;

    address public immutable latte;
    address public immutable gov;
    address public market;

    uint256 public latestBlockTime;
    uint256 public capital;
    uint256 public distributedCapital;

    mapping (uint256 => uint256) public rewards;
    mapping (address => uint256) public blockTimes;
    mapping (address => uint256) public shares;
    mapping (uint256 => uint256) public totalShares;
    mapping (address => mapping(uint256 => bool)) public claimed;

    constructor(address _latte) public {
        latte = _latte;
        gov = msg.sender;
        _update();
    }

    function setMarket(address _market) external {
        require(msg.sender == gov, "Pool: forbidden");
        require(market == address(0), "Pool: market already set");
        market = _market;
    }

    function fund() external override payable {
        capital = capital.add(msg.value);
    }

    function claim() external returns (uint256) {
        return _claim(msg.sender);
    }

    function mint(address _account, uint256 _amount) external override {
        require(msg.sender == market, "Pool: forbidden");
        if (_amount == 0) {
            return;
        }

        _update();
        _claim(_account);
        _rollover(_account, latestBlockTime, blockTimes[_account]);

        shares[_account] = shares[_account].add(_amount);
        totalShares[latestBlockTime] = totalShares[latestBlockTime].add(_amount);
        blockTimes[_account] = latestBlockTime;
    }

    function burn(address _account) external override {
        require(msg.sender == latte, "Pool: forbidden");
        _claim(_account);

        uint256 blockTime = blockTimes[_account];
        if (blockTime == latestBlockTime && shares[_account] != 0) {
            totalShares[blockTime] = totalShares[blockTime].sub(shares[_account]);
        }

        shares[_account] = 0;
    }

    function _update() private {
        uint256 blockTime = block.timestamp;
        if (blockTime.sub(latestBlockTime) < MIN_INTERVAL) {
            return;
        }

        _distribute(latestBlockTime);
        latestBlockTime = blockTime;
    }

    function _distribute(uint256 blockTime) private {
        if (totalShares[blockTime] == 0) {
            return;
        }

        if (rewards[blockTime] != 0) {
            return;
        }

        if (capital == 0) {
            return;
        }

        uint256 reward = capital.sub(distributedCapital).mul(REWARDS_BASIS_POINTS).div(10000);
        rewards[blockTime] = reward;
        distributedCapital = distributedCapital.add(reward);
    }

    function _rollover(address _account, uint256 _blockTime, uint256 _lastBlockTime) private {
        if (_lastBlockTime == 0) {
            return;
        }
        if (_blockTime == _lastBlockTime) {
            return;
        }

        if (_blockTime < _lastBlockTime.add(BONUS_REWARD_INTERVAL)) {
            shares[_account] = 0;
            return;
        }

        // rollover shares from the previous interval
        shares[_account] = shares[_account].mul(BONUS_REWARD_BASIS_POINTS).div(10000);
    }

    function _claim(address _account) private returns (uint256) {
        uint256 blockTime = blockTimes[_account];
        if (blockTime == 0) {
            return 0;
        }

        if (rewards[blockTime] == 0 || shares[_account] == 0 || totalShares[blockTime] == 0) {
            return 0;
        }

        if (claimed[_account][blockTime]) {
            return 0;
        }

        uint256 claimable = rewards[blockTime].mul(shares[_account]).div(totalShares[blockTime]);
        if (claimable == 0) {
            return 0;
        }

        claimed[_account][blockTime] = true;
        address(uint160(_account)).transfer(claimable);
        return claimable;
    }
}
