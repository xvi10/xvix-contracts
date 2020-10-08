//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/IPool.sol";
import "./interfaces/IPricer.sol";

contract Pool is IPool {
    using SafeMath for uint256;

    uint256 public constant MIN_INTERVAL = 24 hours;
    uint256 public constant REWARDS_BASIS_POINTS = 100;
    uint256 public constant BONUS_REWARD_INTERVAL = 7 days;
    uint256 public constant BONUS_REWARD_BASIS_POINTS = 5000;
    uint256 public constant MAX_BASIS_POINTS = 10000;

    address public immutable latte;
    address public immutable pricer;
    address public immutable gov;
    address public market;

    uint256 public latestSlot;
    uint256 public capital;
    uint256 public distributedCapital;

    mapping (uint256 => uint256) public rewards;
    mapping (address => uint256) public slots;
    mapping (uint256 => uint256) public totalShares;
    mapping (uint256 => mapping(address => uint256)) public shares;
    mapping (uint256 => mapping(address => bool)) public claimed;

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

    function claim() external returns (uint256) {
        _moveToNextSlot();
        return _claim(msg.sender);
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

    function burn(address _account) external override {
        require(msg.sender == latte, "Pool: forbidden");

        _moveToNextSlot();
        _claim(_account);

        uint256 slot = slots[_account];
        if (slot != latestSlot) {
            return;
        }

        shares[slot][_account] = 0;
        totalShares[slot] = totalShares[slot].sub(shares[slot][_account]);
    }

    function _rollover(address _account, uint256 nextSlot) private {
        uint256 slot = slots[_account];
        if (slot == 0) {
            return;
        }

        if (slot == nextSlot) {
            return;
        }

        if (nextSlot < slot.add(BONUS_REWARD_INTERVAL)) {
            return;
        }

        shares[nextSlot][_account] = shares[slot][_account].mul(BONUS_REWARD_BASIS_POINTS).div(MAX_BASIS_POINTS);
    }

    function _moveToNextSlot() private {
        uint256 nextSlot = _getNextSlot();
        if (nextSlot.sub(latestSlot) < MIN_INTERVAL) {
            return;
        }

        _distribute(latestSlot);
        latestSlot = nextSlot;
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

        uint256 reward = capital.sub(distributedCapital).mul(REWARDS_BASIS_POINTS).div(MAX_BASIS_POINTS);
        rewards[slot] = reward;
        distributedCapital = distributedCapital.add(reward);
    }

    function _claim(address _account) private returns (uint256) {
        uint256 slot = slots[_account];
        if (slot == 0) {
            return 0;
        }

        if (rewards[slot] == 0 || shares[slot][_account] == 0 || totalShares[slot] == 0) {
            return 0;
        }

        if (claimed[slot][_account]) {
            return 0;
        }

        uint256 claimable = rewards[slot].mul(shares[slot][_account]).div(totalShares[slot]);
        if (claimable == 0) {
            return 0;
        }

        claimed[slot][_account] = true;
        address(uint160(_account)).transfer(claimable);

        return claimable;
    }
}
