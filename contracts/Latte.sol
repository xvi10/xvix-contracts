//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPricer.sol";
import "./interfaces/IPool.sol";

contract Latte is IERC20, ILatte {
    using SafeMath for uint256;

    uint256 public constant BURN_BASIS_POINTS = 500; // 5%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    uint256 public constant MIN_INTERVAL = 30 minutes;
    string public constant name = "Latte";
    string public constant symbol = "LATTE";
    uint8 public constant decimals = 18;

    string public website = "https://lattefi.app";

    address public gov;
    address public cafe;
    address public shopper;
    address public pricer;
    address public pool;
    address public pair;
    address public market;

    bool public guardedTransfer;

    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    uint256 public override totalSupply;
    uint256 public override supplySnapshot;
    uint256 public override snapshotTime;

    constructor(uint256 initialSupply) public {
        gov = msg.sender;
        _mint(msg.sender, initialSupply);
        _update();
    }

    function balanceOf(address _account) public view override returns (uint256) {
        return balances[_account];
    }

    function transfer(address _recipient, uint256 _amount) public override returns (bool) {
        _transfer(msg.sender, _recipient, _amount);
        return true;
    }

    function allowance(address _owner, address _spender) public view override returns (uint256) {
        return allowances[_owner][_spender];
    }

    function approve(address _spender, uint256 _amount) public override returns (bool) {
        _approve(msg.sender, _spender, _amount);
        return true;
    }

    function transferFrom(address _sender, address _recipient, uint256 _amount) public override returns (bool) {
        _approve(_sender, msg.sender, allowances[_sender][msg.sender].sub(_amount, "Latte: transfer amount exceeds allowance"));
        _transfer(_sender, _recipient, _amount);

        return true;
    }

    function increaseAllowance(address _spender, uint256 _addedValue) public returns (bool) {
        _approve(msg.sender, _spender, allowances[msg.sender][_spender].add(_addedValue));
        return true;
    }

    function decreaseAllowance(address _spender, uint256 _subtractedValue) public returns (bool) {
        _approve(msg.sender, _spender, allowances[msg.sender][_spender].sub(_subtractedValue, "Latte: decreased allowance below zero"));
        return true;
    }

    function setWebsite(string memory _website) external {
        require(msg.sender == gov, "Latte: forbidden");
        website = _website;
    }

    function setGov(address _gov) external {
        require(msg.sender == gov, "Latte: forbidden");
        gov = _gov;
    }

    function setCafe(address _cafe) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(cafe == address(0), "Latte: cafe already set");
        cafe = _cafe;
    }

    function setShopper(address _shopper) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(shopper == address(0), "Latte: shopper already set");
        shopper = _shopper;
    }

    function setPricer(address _pricer) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(pricer == address(0), "Latte: pricer already set");
        pricer = _pricer;
    }

    function setPool(address _pool) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(pool == address(0), "Latte: pool already set");
        pool = _pool;
    }

    function setPair(address _pair) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(pair == address(0), "Latte: pair already set");
        pair = _pair;
    }

    function setMarket(address _market) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(market == address(0), "Latte: market already set");
        market = _market;
    }

    function setGuardedTransfer(bool _guardedTransfer) external override {
        require(msg.sender == market, "Latte: forbidden");
        guardedTransfer = _guardedTransfer;
    }

    function mint(address _account, uint256 _amount) external override returns(bool) {
        require(msg.sender == cafe, "Latte: forbidden");
        _mint(_account, _amount);
        return true;
    }

    function burn(address _account, uint256 _amount) external override returns(bool) {
        require(msg.sender == shopper, "Latte: forbidden");
        _burn(_account, _amount);
        return true;
    }

    function update() external {
        _update();
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        require(_sender != address(0), "Latte: transfer from the zero address");
        require(_recipient != address(0), "Latte: transfer to the zero address");

        balances[_sender] = balances[_sender].sub(_amount, "Latte: transfer amount exceeds balance");
        balances[_recipient] = balances[_recipient].add(_amount);
        emit Transfer(_sender, _recipient, _amount);

        if (pool != address(0) && !guardedTransfer) {
            IPool(pool).revokeShares(_sender);
        }

        bool exempted = guardedTransfer || msg.sender == shopper || msg.sender == pair;
        if (IPricer(pricer).hasDecreasingPrice() && !exempted) {
            uint256 burnAmount = _amount.mul(BURN_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
            _burn(_sender, burnAmount);
        }

        _update();
    }

    function _update() private {
        uint256 blockTime = block.timestamp;
        if (blockTime.sub(snapshotTime) > MIN_INTERVAL) {
            supplySnapshot = totalSupply;
            snapshotTime = blockTime;
        }

        if (pricer != address(0)) {
            IPricer(pricer).update();
        }
    }

    function _mint(address _account, uint256 _amount) private {
        require(_account != address(0), "Latte: mint to the zero address");

        totalSupply = totalSupply.add(_amount);
        balances[_account] = balances[_account].add(_amount);
        emit Transfer(address(0), _account, _amount);
    }

    function _burn(address _account, uint256 _amount) private {
        require(_account != address(0), "Latte: burn from the zero address");

        balances[_account] = balances[_account].sub(_amount, "Latte: burn amount exceeds balance");
        totalSupply = totalSupply.sub(_amount);
        emit Transfer(_account, address(0), _amount);
    }

    function _approve(address _owner, address _spender, uint256 _amount) private {
        require(_owner != address(0), "Latte: approve from the zero address");
        require(_spender != address(0), "Latte: approve to the zero address");

        allowances[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }
}
