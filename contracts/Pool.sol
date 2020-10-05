//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/IPool.sol";

contract Pool is IPool {
    using SafeMath for uint256;

    address public immutable latte;
    address public immutable gov;
    address public market;

    uint256 public capital;
    uint256 public totalShares;

    mapping (address => uint256) public shares;
    mapping (address => uint256) public claimed;
    mapping (address => uint256) public capitalSnapshots;

    constructor(address _latte) public {
        latte = _latte;
        gov = msg.sender;
    }

    function setMarket(address _market) external {
        require(msg.sender == gov, "Pool: forbidden");
        require(market == address(0), "Pool: market already set");
        market = _market;
    }

    function fund() external override payable {
        capital = capital.add(msg.value);
    }

    function mint(address _account, uint256 _amount) external override {
        require(msg.sender == market, "Pool: forbidden");
        _claim(_account);

        shares[_account] = shares[_account].add(_amount);
        totalShares = totalShares.add(_amount);

        capitalSnapshots[_account] = capital;
        claimed[_account] = 0;
    }

    function burn(address _account) external override {
        require(msg.sender == latte, "Pool: forbidden");
        if (shares[_account] == 0) {
            return;
        }
        _claim(_account);
        totalShares = totalShares.sub(shares[_account]);
        shares[_account] = 0;
    }

    function _claim(address _account) private {
        uint256 usableCapital = capital.div(200);
        uint256 claimable = shares[_account].mul(usableCapital).div(totalShares);
        uint256 value = claimable.sub(claimed[_account]);
        if (value == 0) {
            return;
        }

        claimed[_account] = claimed[_account].add(value);
        address(uint160(_account)).transfer(value);
    }
}
