//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

contract Latte is IERC20 {
    using SafeMath for uint256;

    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    uint256 public supply;

    string public constant name = "Latte";
    string public constant symbol = "LATTE";
    uint8 public constant decimals = 18;

    string public website = "https://lattefi.app";
    address public gov;
    address public minter;

    constructor() public {
        gov = msg.sender;
    }

    function totalSupply() public view override returns (uint256) {
        return supply;
    }

    function balanceOf(address _account) public view override returns (uint256) {
        return balances[_account];
    }

    function transfer(address _recipient, uint256 _amount) public virtual override returns (bool) {
        _transfer(msg.sender, _recipient, _amount);
        return true;
    }

    function allowance(address _owner, address _spender) public view virtual override returns (uint256) {
        return allowances[_owner][_spender];
    }

    function approve(address _spender, uint256 _amount) public virtual override returns (bool) {
        _approve(msg.sender, _spender, _amount);
        return true;
    }

    function transferFrom(address _sender, address _recipient, uint256 _amount) public virtual override returns (bool) {
        _transfer(_sender, _recipient, _amount);
        _approve(_sender, msg.sender, allowances[_sender][msg.sender].sub(_amount, "Latte: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address _spender, uint256 _addedValue) public virtual returns (bool) {
        _approve(msg.sender, _spender, allowances[msg.sender][_spender].add(_addedValue));
        return true;
    }

    function decreaseAllowance(address _spender, uint256 _subtractedValue) public virtual returns (bool) {
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

    function setMinter(address _minter) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(minter == address(0), "Latte: minter already set");
        minter = _minter;
    }

    function mint(address _account, uint256 _amount) external returns(bool) {
        require(msg.sender == minter, "Latte: forbidden");
        _mint(_account, _amount);
        return true;
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) internal virtual {
        require(_sender != address(0), "Latte: transfer from the zero address");
        require(_recipient != address(0), "Latte: transfer to the zero address");

        balances[_sender] = balances[_sender].sub(_amount, "Latte: transfer amount exceeds balance");
        balances[_recipient] = balances[_recipient].add(_amount);
        emit Transfer(_sender, _recipient, _amount);
    }

    function _mint(address _account, uint256 _amount) internal virtual {
        require(_account != address(0), "Latte: mint to the zero address");

        supply = supply.add(_amount);
        balances[_account] = balances[_account].add(_amount);
        emit Transfer(address(0), _account, _amount);
    }

    function _burn(address _account, uint256 _amount) internal virtual {
        require(_account != address(0), "Latte: burn from the zero address");

        balances[_account] = balances[_account].sub(_amount, "Latte: burn amount exceeds balance");
        supply = supply.sub(_amount);
        emit Transfer(_account, address(0), _amount);
    }

    function _approve(address _owner, address _spender, uint256 _amount) internal virtual {
        require(_owner != address(0), "Latte: approve from the zero address");
        require(_spender != address(0), "Latte: approve to the zero address");

        allowances[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }
}
