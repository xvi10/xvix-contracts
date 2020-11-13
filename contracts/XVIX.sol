//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/IXVIX.sol";
import "./interfaces/IFloor.sol";


contract XVIX is IERC20, IXVIX {
    using SafeMath for uint256;

    struct TransferConfig {
        bool active;
        uint256 senderBurnBasisPoints;
        uint256 senderFundBasisPoints;
        uint256 receiverBurnBasisPoints;
        uint256 receiverFundBasisPoints;
    }

    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant REBASE_DIVISOR;

    string public constant name = "XVIX";
    string public constant symbol = "XVIX";
    uint8 public constant decimals = 18;

    string public website = "https://xvix.finance/";

    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    address public gov;
    address public minter;
    address public floor;
    address public fund;

    uint256 public normalSupply;
    uint256 public safeSupply;
    uint256 public override maxSupply;

    uint256 public rebaseMultiplier;
    uint256 public rebaseInterval = 1 hour;

    uint256 public defaultSenderBurnBasisPoints = 93; // 0.93%
    uint256 public defaultSenderFundBasisPoints = 7; // 0.07%
    uint256 public defaultReceiverBurnBasisPoints = 0;
    uint256 public defaultReceiverFundBasisPoints = 0;

    // msg.sender => transfer config
    mapping (address => TransferConfig) transferConfigs;

    // balances in safe addresses do not get rebased
    mapping (address => bool) public safes;

    event Toast(address indexed account, uint256 value);
    event FloorPrice(uint256 capital, uint256 supply);

    constructor(uint256 initialSupply, uint256 _maxSupply) public {
        gov = msg.sender;
        maxSupply = _maxSupply;
        _mint(msg.sender, initialSupply);
    }

    function createSafe(address _account) public {
        require(msg.sender == gov, "XVIX: forbidden");

        require(!safes[_account], "XVIX: account is already a safe");
        uint256 balance = balanceOf(_account);
        // the balance of the account might not be zero here due to of rounding
        // but the amount should be insignificant
        _subtract(_account, balance);

        safes[_account] = true;
        _add(_account, balance);
    }

    function destroySafe(address _account) public {
        require(msg.sender == gov, "XVIX: forbidden");

        require(safes[_account], "XVIX: account is not a safe");
        uint256 balance = balanceOf(_account);
        _subtract(_account, balance);

        safes[_account] = false;
        _add(_account, balance);
    }

    function balanceOf(address _account) public view override returns (uint256) {
        if (safes[_account]) {
            return balances[_account];
        }

        return balances[_account].mul(rebaseMultiplier).div(REBASE_DIVISOR);
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
        uint256 nextAllowance = allowances[_sender][msg.sender].sub(_amount, "XVIX: transfer amount exceeds allowance");
        _approve(_sender, msg.sender, nextAllowance);
        _transfer(_sender, _recipient, _amount);

        return true;
    }

    function setGov(address _gov) public {
        require(msg.sender == gov, "XVIX: forbidden");
        gov = _gov;
    }

    function setWebsite(string memory _website) public {
        require(msg.sender == gov, "XVIX: forbidden");
        website = _website;
    }

    function setMinter(address _minter) public {
        require(msg.sender == gov, "XVIX: forbidden");
        require(minter == address(0), "XVIX: minter already set");
        minter = _minter;
    }

    function setFloor(address _floor) public {
        require(msg.sender == gov, "XVIX: forbidden");
        require(floor == address(0), "XVIX: floor already set");
        floor = _floor;
    }

    function setFund(address _fund) public {
        require(msg.sender == gov, "XVIX: forbidden");
        fund = _fund;
    }

    function mint(address _account, uint256 _amount) public override returns (bool) {
        require(msg.sender == minter, "XVIX: forbidden");
        _mint(_account, _amount);
        return true;
    }

    function burn(address _account, uint256 _amount) public override returns (bool) {
        require(msg.sender == floor, "XVIX: forbidden");
        _burn(_account, _amount);
        return true;
    }

    function toast(uint256 _amount) public returns (bool) {
        _burn(msg.sender, _amount);
        emit Toast(msg.sender, _amount);
        return true;
    }

    function rebasedSupply() public returns (uint256) {
        return normalSupply.mul(rebaseMultiplier).div(REBASE_DIVISOR);
    }

    function totalSupply() public override returns (uint256) {
        return rebasedSupply().add(safeSupply);
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        require(_sender != address(0), "XVIX: transfer from the zero address");
        require(_recipient != address(0), "XVIX: transfer to the zero address");

        uint256 senderBurn = defaultSenderBurnBasisPoints;
        uint256 senderFund = defaultSenderFundBasisPoints;
        uint256 receiverBurn = defaultReceiverBurnBasisPoints;
        uint256 receiverFund = defaultReceiverFundBasisPoints;

        TransferConfig memory config = transferConfigs[msg.sender];
        if (config.active) {
            senderBurn = config.senderBurnBasisPoints;
            senderFund = config.senderFundBasisPoints;
            receiverBurn = config.receiverBurnBasisPoints;
            receiverFund = config.receiverFundBasisPoints;
        }

        uint256 subAmount = _amount;
        uint256 senderBasisPoints = senderBurn.add(senderFund);
        if (senderBasisPoints > 0) {
            uint256 x = _amount.mul(senderBasisPoints).div(BASIS_POINTS_DIVISOR);
            subAmount = subAmount.add(x);
        }

        uint256 addAmount = _amount;
        uint256 receiverBasisPoints = receiverBurn.add(receiverFund);
        if (receiverBasisPoints > 0) {
            uint256 x = _amount.mul(receiverBasisPoints).div(BASIS_POINTS_DIVISOR);
            addAmount = addAmount.sub(x);
        }

        _subtract(_sender, subAmount);
        _add(_recipient, addAmount);

        emit Transfer(_sender, _recipient, addAmount);

        uint256 fundBasisPoints = senderFund.add(receiverFund);
        uint256 fundAmount = _amount.mul(fundBasisPoints).dic(BASIS_POINTS_DIVISOR);
        if (fundAmount > 0) {
            _add(fund, fundAmount);
            emit Transfer(_sender, fund, fundAmount);
        }

        uint256 burnAmount = subAmount.sub(addAmount).sub(fundAmount);
        if (burnAmount > 0) {
            emit Transfer(_sender, address(0), burnAmoun);
        }
    }

    function _getTransferBurnAmount(uint256 _amount) private pure returns (uint256) {
        return _amount.mul(transferBurnBasisPoints).div(BASIS_POINTS_DIVISOR);
    }

    function _approve(address _owner, address _spender, uint256 _amount) private {
        require(_owner != address(0), "XVIX: approve from the zero address");
        require(_spender != address(0), "XVIX: approve to the zero address");

        allowances[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }

    function _mint(address _account, uint256 _amount) private {
        require(_account != address(0), "XVIX: mint to the zero address");
        if (_amount == 0) { return; }

        _add(_account, _amount);
        emit Transfer(address(0), _account, _amount);

        _emitFloorPrice();
    }

    function _burn(address _account, uint256 _amount) private {
        require(_account != address(0), "XVIX: burn from the zero address");
        if (_amount == 0) { return; }

        _subtract(_account, _amount);
        emit Transfer(_account, address(0), _amount);

        _emitFloorPrice();
    }

    function _add(address _account, uint256 _amount) private {
        if (safes[_account]) {
            balances[_account] = balances[_account].add(_amount);
            safeSupply = safeSupply.add(_amount);
            _ensureMaxSupply();
            return;
        }

        uint256 adjustedAmount = _getAdjustedAmount(_amount);
        balances[_account] = balances[_account].add(adjustedAmount);
        normalSupply = normalSupply.add(adjustedAmount);
        _ensureMaxSupply();
    }

    function _subtract(address _account, uint256 _amount) private returns (uint256) {
        if (safes[_account]) {
            balances[_account] = balances[_account].sub(_amount, "XVIX: subtraction amount exceeds balance");
            safeSupply = safeSupply.sub(_amount);
            return _amount;
        }

        uint256 adjustedAmount = _getAdjustedAmount(_amount);
        balances[_account] = balances[_account].sub(adjustedAmount, "XVIX: subtraction amount exceeds balance");
        normalSupply = normalSupply.sub(adjustedAmount);

        return adjustedAmount;
    }

    // there may be some truncation here which would cause the adjusted amount
    // to be rounded down
    // rounding down should prevent overflow issues when a user is trying
    // to transfer out their entire balance
    function _getAdjustedAmount(uint256 _amount) private {
        return _amount.mul(REBASE_DIVISOR).div(rebaseMultiplier);
    }

    function _ensureMaxSupply() private {
        require(totalSupply() <= maxSupply, "XVIX: max supply exceeded");
    }

    function _emitFloorPrice() private {
        if (floor != address(0)) {
            emit FloorPrice(IFloor(floor).capital(), totalSupply());
        }
    }
}
