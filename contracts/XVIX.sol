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

    uint256 public constant MAX_FUND_BASIS_POINTS = 20; // 0.2%
    uint256 public constant MAX_BURN_BASIS_POINTS = 500; // 5%

    uint256 public constant MIN_REBASE_INTERVAL = 30 minutes;
    uint256 public constant MAX_REBASE_INTERVAL = 1 weeks;
    uint256 public constant MAX_INTERVALS_PER_REBASE = 10;
    uint256 public constant MAX_REBASE_BASIS_POINTS = 500; // 5%

    // MAX_NORMAL_DIVISOR will be reached 20 years after the first rebase
    uint256 public constant MAX_NORMAL_DIVISOR = 10**23;
    uint256 public constant SAFE_DIVISOR = 10**8;

    string public constant name = "XVIX";
    string public constant symbol = "XVIX";
    uint8 public constant decimals = 18;

    string public website = "https://xvix.finance/";

    address public gov;
    address public minter;
    address public floor;
    address public distributor;
    address public fund;

    uint256 public _normalSupply;
    uint256 public _safeSupply;
    uint256 public override maxSupply;

    uint256 public normalDivisor = 10**8;
    uint256 public rebaseInterval = 1 hours;
    uint256 public rebaseBasisPoints = 2; // 0.02%
    uint256 public nextRebaseTime = 0;

    uint256 public defaultSenderBurnBasisPoints = 0;
    uint256 public defaultSenderFundBasisPoints = 0;
    uint256 public defaultReceiverBurnBasisPoints = 93; // 0.93%
    uint256 public defaultReceiverFundBasisPoints = 7; // 0.07%

    uint256 public govHandoverTime;

    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    // msg.sender => transfer config
    mapping (address => TransferConfig) public transferConfigs;

    // balances in safe addresses do not get rebased
    mapping (address => bool) public safes;

    event Toast(address indexed account, uint256 value, uint256 maxSupply);
    event FloorPrice(uint256 capital, uint256 supply);
    event Rebase(uint256 normalDivisor);

    modifier onlyGov() {
        require(msg.sender == gov, "XVIX: forbidden");
        _;
    }

    // the govHandoverTime should be set to a time after XLGE participants can
    // withdraw their funds
    modifier onlyAfterHandover() {
        require(block.timestamp > govHandoverTime, "XVIX: handover time has not passed");
        _;
    }

    modifier invariantTotalSupply() {
        uint256 supply = totalSupply();
        _;
        require(supply == totalSupply(), "XVIX: total supply was modified");
    }

    modifier enforceMaxSupply() {
        _;
        require(totalSupply() <= maxSupply, "XVIX: max supply exceeded");
    }

    constructor(uint256 _initialSupply, uint256 _maxSupply, uint256 _govHandoverTime) public {
        gov = msg.sender;
        govHandoverTime = _govHandoverTime;
        maxSupply = _maxSupply;
        _mint(msg.sender, _initialSupply);
        _setNextRebaseTime();
    }

    function setGov(address _gov) public onlyGov {
        gov = _gov;
    }

    function setWebsite(string memory _website) public onlyGov {
        website = _website;
    }

    function setMinter(address _minter) public onlyGov {
        require(minter == address(0), "XVIX: minter already set");
        minter = _minter;
    }

    function setFloor(address _floor) public onlyGov {
        require(floor == address(0), "XVIX: floor already set");
        floor = _floor;
    }

    function setDistributor(address _distributor) public onlyGov {
        require(distributor == address(0), "XVIX: distributor already set");
        distributor = _distributor;
    }

    function setFund(address _fund) public onlyGov {
        fund = _fund;
    }

    function createSafe(address _account) public onlyGov invariantTotalSupply enforceMaxSupply {
        require(!safes[_account], "XVIX: account is already a safe");
        safes[_account] = true;

        uint256 balance = balances[_account];
        _normalSupply = _normalSupply.sub(balance);

        uint256 safeBalance = balance.mul(SAFE_DIVISOR).div(normalDivisor);
        balances[_account] = safeBalance;
        _safeSupply = _safeSupply.add(safeBalance);
    }

    // possible gov attack vector: since XLGE participants have their funds locked
    // for one month, it is possible for gov to create a safe address and keep
    // XVIX tokens there while destroying all other safes
    // this would raise the value of the tokens kept in the safe address
    // the onlyAfterHandover modifier is added to guard against this case
    // if this attack is attempted when XLGE participants can withdraw their funds
    // then it would be difficult for the attack to be profitable
    // since the attack would cause the price of XVIX to drop and XLGE participants
    // would withdraw their funds as well
    function destroySafe(address _account) public onlyGov onlyAfterHandover invariantTotalSupply enforceMaxSupply {
        require(safes[_account], "XVIX: account is not a safe");
        safes[_account] = false;

        uint256 balance = balances[_account];
        _safeSupply = _safeSupply.sub(balance);

        uint256 normalBalance = balance.mul(normalDivisor).div(SAFE_DIVISOR);
        balances[_account] = normalBalance;
        _normalSupply = _normalSupply.add(normalBalance);
    }

    function setRebaseConfig(
        uint256 _rebaseInterval,
        uint256 _rebaseBasisPoints
    ) public onlyGov onlyAfterHandover {
        require(_rebaseInterval >= MIN_REBASE_INTERVAL, "XVIX: rebaseInterval below limit");
        require(_rebaseInterval <= MAX_REBASE_INTERVAL, "XVIX: rebaseInterval exceeds limit");
        require(_rebaseBasisPoints <= MAX_REBASE_BASIS_POINTS, "XVIX: rebaseBasisPoints exceeds limit");

        rebaseInterval = _rebaseInterval;
        rebaseBasisPoints = _rebaseBasisPoints;
    }

    function setDefaultTransferConfig(
        uint256 _senderBurnBasisPoints,
        uint256 _senderFundBasisPoints,
        uint256 _receiverBurnBasisPoints,
        uint256 _receiverFundBasisPoints
    ) public onlyGov onlyAfterHandover {
        _validateTransferConfig(
            _senderBurnBasisPoints,
            _senderFundBasisPoints,
            _receiverBurnBasisPoints,
            _receiverFundBasisPoints
        );

        defaultSenderBurnBasisPoints = _senderBurnBasisPoints;
        defaultSenderFundBasisPoints = _senderFundBasisPoints;
        defaultReceiverBurnBasisPoints = _receiverBurnBasisPoints;
        defaultReceiverFundBasisPoints = _receiverFundBasisPoints;
    }

    function createTransferConfig(
        address _msgSender,
        uint256 _senderBurnBasisPoints,
        uint256 _senderFundBasisPoints,
        uint256 _receiverBurnBasisPoints,
        uint256 _receiverFundBasisPoints
    ) public onlyGov {
        require(_msgSender != address(0), "XVIX: cannot set zero address");
        _validateTransferConfig(
            _senderBurnBasisPoints,
            _senderFundBasisPoints,
            _receiverBurnBasisPoints,
            _receiverFundBasisPoints
        );

        transferConfigs[_msgSender] = TransferConfig(
            true,
            _senderBurnBasisPoints,
            _senderFundBasisPoints,
            _receiverBurnBasisPoints,
            _receiverFundBasisPoints
        );
    }

    function destroyTransferConfig(address _msgSender) public onlyGov onlyAfterHandover {
        delete transferConfigs[_msgSender];
    }

    function rebase() public override {
        if (block.timestamp < nextRebaseTime) { return; }
        // calculate the number of intervals that have passed
        uint256 timeDiff = block.timestamp.sub(nextRebaseTime);
        uint256 intervals = timeDiff.div(rebaseInterval).add(1);

        // the multiplier is calculated as (~10000)^intervals
        // the max value of intervals is capped at 10 to avoid uint256 overflow
        // 2^256 has 77 digits
        // 10,000^10 has 40
        // MAX_NORMAL_DIVISOR has 23 digits
        if (intervals > MAX_INTERVALS_PER_REBASE) {
            intervals = MAX_INTERVALS_PER_REBASE;
        }

        _setNextRebaseTime();

        if (rebaseBasisPoints == 0) { return; }

        uint256 multiplier = BASIS_POINTS_DIVISOR.add(rebaseBasisPoints) ** intervals;
        uint256 divider = BASIS_POINTS_DIVISOR ** intervals;

        uint256 nextDivisor = normalDivisor.mul(multiplier).div(divider);
        if (nextDivisor > MAX_NORMAL_DIVISOR) {
            return;
        }

        normalDivisor = nextDivisor;
        emit Rebase(normalDivisor);
    }

    function mint(address _account, uint256 _amount) public override returns (bool) {
        require(msg.sender == minter, "XVIX: forbidden");
        _mint(_account, _amount);
        return true;
    }

    // permanently remove tokens from circulation by reducing maxSupply
    function toast(uint256 _amount) public override returns (bool) {
        require(msg.sender == distributor, "XVIX: forbidden");
        if (_amount == 0) { return false; }

        _burn(msg.sender, _amount);
        maxSupply = maxSupply.sub(_amount);
        emit Toast(msg.sender, _amount, maxSupply);

        return true;
    }

    function burn(address _account, uint256 _amount) public override returns (bool) {
        require(msg.sender == floor, "XVIX: forbidden");
        _burn(_account, _amount);
        return true;
    }

    function balanceOf(address _account) public view override returns (uint256) {
        if (safes[_account]) {
            return balances[_account].div(SAFE_DIVISOR);
        }

        return balances[_account].div(normalDivisor);
    }

    function transfer(address _recipient, uint256 _amount) public override returns (bool) {
        _transfer(msg.sender, _recipient, _amount);
        rebase();
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
        rebase();
        return true;
    }

    function normalSupply() public view returns (uint256) {
        return _normalSupply.div(normalDivisor);
    }

    function safeSupply() public view returns (uint256) {
        return _safeSupply.div(SAFE_DIVISOR);
    }

    function totalSupply() public view override returns (uint256) {
        return normalSupply().add(safeSupply());
    }

    function _validateTransferConfig(
        uint256 _senderBurnBasisPoints,
        uint256 _senderFundBasisPoints,
        uint256 _receiverBurnBasisPoints,
        uint256 _receiverFundBasisPoints
    ) private pure {
        require(_senderBurnBasisPoints <= MAX_BURN_BASIS_POINTS, "XVIX: senderBurnBasisPoints exceeds limit");
        require(_senderFundBasisPoints <= MAX_FUND_BASIS_POINTS, "XVIX: senderFundBasisPoints exceeds limit");
        require(_receiverBurnBasisPoints <= MAX_BURN_BASIS_POINTS, "XVIX: receiverBurnBasisPoints exceeds limit");
        require(_receiverFundBasisPoints <= MAX_FUND_BASIS_POINTS, "XVIX: receiverFundBasisPoints exceeds limit");
    }

    function _setNextRebaseTime() private {
        uint256 roundedTime = block.timestamp.div(rebaseInterval).mul(rebaseInterval);
        nextRebaseTime = roundedTime.add(rebaseInterval);
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        require(_sender != address(0), "XVIX: transfer from the zero address");
        require(_recipient != address(0), "XVIX: transfer to the zero address");
        uint256 supply = totalSupply();

        (uint256 senderBurn,
         uint256 senderFund,
         uint256 receiverBurn,
         uint256 receiverFund) = _getTransferConfig();

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

        _decreaseBalance(_sender, subAmount);
        _increaseBalance(_recipient, addAmount);

        emit Transfer(_sender, _recipient, addAmount);

        uint256 fundBasisPoints = senderFund.add(receiverFund);
        uint256 fundAmount = _amount.mul(fundBasisPoints).div(BASIS_POINTS_DIVISOR);
        if (fundAmount > 0) {
            _increaseBalance(fund, fundAmount);
            emit Transfer(_sender, fund, fundAmount);
        }

        uint256 burnAmount = subAmount.sub(addAmount).sub(fundAmount);
        if (burnAmount > 0) {
            emit Transfer(_sender, address(0), burnAmount);
        }

        require(totalSupply() <= supply, "XVIX: total supply was increased");

        _emitFloorPrice();
    }

    function _getTransferConfig() private view returns (uint256, uint256, uint256, uint256) {
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

        return (senderBurn, senderFund, receiverBurn, receiverFund);
    }

    function _approve(address _owner, address _spender, uint256 _amount) private {
        require(_owner != address(0), "XVIX: approve from the zero address");
        require(_spender != address(0), "XVIX: approve to the zero address");

        allowances[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }

    function _mint(address _account, uint256 _amount) private returns (uint256) {
        require(_account != address(0), "XVIX: mint to the zero address");
        if (_amount == 0) { return 0; }

        uint256 adjustedAmount = _increaseBalance(_account, _amount);
        emit Transfer(address(0), _account, _amount);
        _emitFloorPrice();

        return adjustedAmount;
    }

    function _burn(address _account, uint256 _amount) private returns (uint256) {
        require(_account != address(0), "XVIX: burn from the zero address");
        if (_amount == 0) { return 0; }

        uint256 adjustedAmount = _decreaseBalance(_account, _amount);
        emit Transfer(_account, address(0), _amount);
        _emitFloorPrice();

        return adjustedAmount;
    }

    function _increaseBalance(address _account, uint256 _amount) private enforceMaxSupply returns (uint256) {
        if (_amount == 0) { return 0; }

        if (safes[_account]) {
            uint256 adjustedAmount = _amount.mul(SAFE_DIVISOR);
            balances[_account] = balances[_account].add(adjustedAmount);
            _safeSupply = _safeSupply.add(adjustedAmount);
            return adjustedAmount;
        }

        uint256 adjustedAmount = _amount.mul(normalDivisor);
        balances[_account] = balances[_account].add(adjustedAmount);
        _normalSupply = _normalSupply.add(adjustedAmount);

        return adjustedAmount;
    }

    function _decreaseBalance(address _account, uint256 _amount) private returns (uint256) {
        if (_amount == 0) { return 0; }

        if (safes[_account]) {
            uint256 adjustedAmount = _amount.mul(SAFE_DIVISOR);
            balances[_account] = balances[_account].sub(adjustedAmount, "XVIX: subtraction amount exceeds balance");
            _safeSupply = _safeSupply.sub(adjustedAmount);
            return _amount;
        }

        uint256 adjustedAmount = _amount.mul(normalDivisor);
        balances[_account] = balances[_account].sub(adjustedAmount, "XVIX: subtraction amount exceeds balance");
        _normalSupply = _normalSupply.sub(adjustedAmount);

        return adjustedAmount;
    }

    function _emitFloorPrice() private {
        if (_isContract(floor)) {
            emit FloorPrice(IFloor(floor).capital(), totalSupply());
        }
    }

    function _isContract(address account) private view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(account) }
        return size > 0;
    }
}
