//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/IPool.sol";
import "./interfaces/IPricer.sol";

contract Pool is IPool {
    using SafeMath for uint256;

    uint256 public constant MIN_INTERVAL = 24 hours;
    uint256 public constant REWARD_BASIS_POINTS = 100;
    uint256 public constant BONUS_REWARD_BASIS_POINTS = 100;
    uint256 public constant ROLLOVER_BASIS_POINTS = 5000;
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    address public immutable latte;
    address public immutable gov;
    address public pricer;
    address public market;

    uint256 public latestSlot;
    uint256 public capital;
    uint256 public distributedCapital;

    mapping (uint256 => uint256) public rewards;
    mapping (address => uint256) public slots;
    mapping (uint256 => uint256) public totalShares;
    mapping (uint256 => mapping(address => uint256)) public shares;
    mapping (uint256 => mapping(address => bool)) public claimed;
    mapping (uint256 => uint224) public prices;

    constructor(address _latte, address _pricer) public {
        latte = _latte;
        pricer = _pricer;
        gov = msg.sender;
        _moveToNextSlot();
    }

    function setMarket(address _market) external {
        require(msg.sender == gov, "Pool: forbidden");
        require(market == address(0), "Pool: market already set");
        market = _market;
    }

    function fund() external override payable {
        capital = capital.add(msg.value);
    }

    function moveToNextSlot() external {
        _moveToNextSlot();
    }

    function claim() external {
        _moveToNextSlot();
        _claim(msg.sender);
    }

    function mint(address _account, uint256 _amount) external override {
        require(msg.sender == market, "Pool: forbidden");
        if (_amount == 0) {
            return;
        }

        if (!IPricer(pricer).hasDecreasingPrice()) {
            return;
        }

        _moveToNextSlot();
        _claim(_account);
        _rollover(_account, latestSlot);

        shares[latestSlot][_account] = shares[latestSlot][_account].add(_amount);
        totalShares[latestSlot] = totalShares[latestSlot].add(_amount);
        slots[_account] = latestSlot;
    }

    function revokeShares(address _account) external override {
        require(msg.sender == latte, "Pool: forbidden");

        _moveToNextSlot();
        _claim(_account);

        uint256 slot = slots[_account];
        if (slot == latestSlot) {
            totalShares[slot] = totalShares[slot].sub(shares[slot][_account]);
        }

        shares[slot][_account] = 0;
    }

    function _rollover(address _account, uint256 nextSlot) private {
        uint256 slot = slots[_account];
        if (slot == 0) {
            return;
        }

        if (slot == nextSlot) {
            return;
        }

        shares[nextSlot][_account] = shares[slot][_account].mul(ROLLOVER_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
    }

    function _moveToNextSlot() private {
        uint256 nextSlot = _getNextSlot();
        if (nextSlot.sub(latestSlot) < MIN_INTERVAL) {
            return;
        }

        _distribute(latestSlot);
        latestSlot = nextSlot;
        prices[latestSlot] = IPricer(pricer).lastPrice();
    }

    function _getNextSlot() private view returns (uint256) {
        return block.timestamp;
    }

    function _distribute(uint256 slot) private {
        if (totalShares[slot] == 0) {
            return;
        }

        if (rewards[slot] != 0) {
            return;
        }

        if (capital == 0) {
            return;
        }

        uint256 rewardBasisPoints = REWARD_BASIS_POINTS;
        if (IPricer(pricer).lastPrice() > prices[slot]) {
            rewardBasisPoints = rewardBasisPoints.add(BONUS_REWARD_BASIS_POINTS);
        }

        uint256 reward = capital.sub(distributedCapital).mul(rewardBasisPoints).div(BASIS_POINTS_DIVISOR);
        rewards[slot] = reward;
        distributedCapital = distributedCapital.add(reward);
    }

    function _claim(address _account) private {
        uint256 slot = slots[_account];
        if (slot == 0) {
            return;
        }

        if (rewards[slot] == 0 || shares[slot][_account] == 0 || totalShares[slot] == 0) {
            return;
        }

        if (claimed[slot][_account]) {
            return;
        }

        uint256 claimable = rewards[slot].mul(shares[slot][_account]).div(totalShares[slot]);
        if (claimable == 0) {
            return;
        }

        claimed[slot][_account] = true;
        (bool success,) = _account.call{value: claimable}("");
        require(success, "Pool: transfer failed");
    }
}
