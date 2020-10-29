//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/ICafe.sol";


contract Latte is IERC20, ILatte {
    using SafeMath for uint256;

    struct Ledger {
        uint32 slot0;
        uint96 balance0;
        uint32 slot1;
        uint96 balance1;
    }

    uint256 public constant BURN_BASIS_POINTS = 500; // 5%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    uint256 public constant BURN_INTERVAl = 7 days;

    string public constant name = "Latte";
    string public constant symbol = "LATTE";
    uint8 public constant decimals = 18;

    string public website = "https://lattefi.com";

    address public gov;
    address public cafe;
    address public pool;
    address public distributor;

    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;
    uint256 public override totalSupply;

    mapping (address => bool) public exemptions;

    // account => ledger
    mapping (address => Ledger) ledgers;
    // account => slot => burn amount
    mapping (address => mapping (uint256 => uint256)) burnRegistry;

    constructor(uint256 initialSupply) public {
        gov = msg.sender;
        _mint(msg.sender, initialSupply);
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

    function setGov(address _gov) external {
        require(msg.sender == gov, "Latte: forbidden");
        gov = _gov;
    }

    function setWebsite(string memory _website) external {
        require(msg.sender == gov, "Latte: forbidden");
        website = _website;
    }

    function setCafe(address _cafe) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(cafe == address(0), "Latte: cafe already set");
        cafe = _cafe;
    }

    function setPool(address _pool) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(pool == address(0), "Latte: pool already set");
        pool = _pool;
    }

    function setDistributor(address _distributor) external {
        require(msg.sender == gov, "Latte: forbidden");
        require(distributor == address(0), "Latte: distributor already set");
        distributor = _distributor;
    }

    function addExemption(address _account) external {
        require(msg.sender == gov, "Latte: forbidden");
        exemptions[_account] = true;
    }

    function removeExemption(address _account) external {
        require(msg.sender == gov, "Latte: forbidden");
        exemptions[_account] = false;
    }

    function mint(address _account, uint256 _amount) external override returns (bool) {
        require(msg.sender == cafe || msg.sender == distributor, "Latte: forbidden");
        _mint(_account, _amount);
        return true;
    }

    function burn(address _account, uint256 _amount) external override returns (bool) {
        require(msg.sender == pool, "Latte: forbidden");
        _burn(_account, _amount);
        return true;
    }

    function toast(uint256 _amount) external returns (bool) {
        _burn(msg.sender, _amount);
        return true;
    }

    function roast(address _account, address _feeTo) external returns (bool) {
        uint256 toBurn = getBurnAllowance(_account);
        require(toBurn > 0, "Latte: burn amount is zero");
        _burn(_account, toBurn.mul(2)); // burn twice the burn amount
        _mint(_feeTo, toBurn); // mint the fee to the user

        return true;
    }

    function getBurnAllowance(address _account) public view returns (uint256) {
        uint32 slot = getLatestSlot();

        Ledger memory ledger = ledgers[_account];
        uint256 burnt = burnRegistry[_account][slot - 1]; // amount burnt in previous slot

        if (ledger.slot1 < slot && ledger.balance1 > 0) {
            return _getBurnAmount(uint256(ledger.balance1)).sub(burnt);
        }

        if (ledger.slot0 < slot && ledger.balance0 > 0) {
            return _getBurnAmount(uint256(ledger.balance0)).sub(burnt);
        }

        return 0;
    }

    function getLatestSlot() public view returns (uint32) {
        return uint32(block.timestamp / BURN_INTERVAl);
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        require(_sender != address(0), "Latte: transfer from the zero address");
        require(_recipient != address(0), "Latte: transfer to the zero address");

        balances[_sender] = balances[_sender].sub(_amount, "Latte: transfer amount exceeds balance");
        balances[_recipient] = balances[_recipient].add(_amount);
        emit Transfer(_sender, _recipient, _amount);

        _updateLedger(_sender);
        _updateLedger(_recipient);

        if (!exemptions[msg.sender]) {
            _burn(_sender, _getBurnAmount(_amount));
        }
    }

    function _getBurnAmount(uint256 _amount) private pure returns (uint256) {
        return _amount.mul(BURN_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
    }

    function _updateLedger(address _account) private {
        uint96 balance = uint96(balances[_account]);
        require(balance < uint96(-1), "Latte: balance is too large");

        uint32 slot = getLatestSlot();

        Ledger storage ledger = ledgers[_account];
        if (ledger.slot1 != slot) {
            ledger.slot0 = ledger.slot1;
            ledger.balance0 = ledger.balance1;
        }

        ledger.slot1 = slot;
        ledger.balance1 = balance;
    }

    function _mint(address _account, uint256 _amount) private {
        require(_account != address(0), "Latte: mint to the zero address");
        if (_amount == 0) {
            return;
        }

        totalSupply = totalSupply.add(_amount);
        balances[_account] = balances[_account].add(_amount);
        _updateLedger(_account);

        emit Transfer(address(0), _account, _amount);
    }

    function _burn(address _account, uint256 _amount) private {
        require(_account != address(0), "Latte: burn from the zero address");
        if (_amount == 0) {
            return;
        }

        balances[_account] = balances[_account].sub(_amount, "Latte: burn amount exceeds balance");
        totalSupply = totalSupply.sub(_amount);
        _updateLedger(_account);

        uint256 slot = getLatestSlot() - 1;
        burnRegistry[_account][slot] = burnRegistry[_account][slot].add(_amount);

        ICafe(cafe).increaseTokenReserve(_amount);
        emit Transfer(_account, address(0), _amount);
    }

    function _approve(address _owner, address _spender, uint256 _amount) private {
        require(_owner != address(0), "Latte: approve from the zero address");
        require(_spender != address(0), "Latte: approve to the zero address");

        allowances[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }
}
