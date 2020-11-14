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
    uint256 public constant MIN_REBASE_BASIS_POINTS = 1; // 0.01%
    uint256 public constant MAX_REBASE_BASIS_POINTS = 500; // 5%

    // this will be reached 20 years after the first rebase
    uint256 public constant MAX_NORMAL_DIVISOR = 10**23;

    uint256 public constant SAFE_DIVISOR = 10**8;

    string public constant name = "XVIX";
    string public constant symbol = "XVIX";
    uint8 public constant decimals = 18;

    string public website = "https://xvix.finance/";

    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    address public gov;
    address public minter;
    address public floor;
    address public distributor;
    address public fund;

    uint256 public normalSupply;
    uint256 public safeSupply;
    uint256 public override maxSupply;

    uint256 public normalDivisor = 10**8;
    uint256 public rebaseInterval = 1 hours;
    uint256 public rebaseBasisPoints = 2; // 0.02%
    uint256 public nextRebaseTime = 0;

    uint256 public defaultSenderBurnBasisPoints = 93; // 0.93%
    uint256 public defaultSenderFundBasisPoints = 7; // 0.07%
    uint256 public defaultReceiverBurnBasisPoints = 0;
    uint256 public defaultReceiverFundBasisPoints = 0;

    uint256 public govHandoverTime;

    // msg.sender => transfer config
    mapping (address => TransferConfig) transferConfigs;

    // balances in safe addresses do not get rebased
    mapping (address => bool) public safes;

    event Toast(address indexed account, uint256 value);
    event Lock(address indexed account, uint256 value, uint256 maxSupply);
    event FloorPrice(uint256 capital, uint256 supply);
    event Rebase(uint256 normalDivisor);

    modifier onlyGov() {
        require(msg.sender == gov, "XVIX: forbidden");
        _;
    }

    modifier onlyAfterHandover() {
        require(block.timestamp > govHandoverTime, "XVIX: handover time has not passed");
        _;
    }

    constructor(uint256 _initialSupply, uint256 _maxSupply, uint256 _govHandoverTime) public {
        gov = msg.sender;
        govHandoverTime = _govHandoverTime;
        maxSupply = _maxSupply;
        _mint(msg.sender, _initialSupply);
        _setNextRebaseTime();
    }

    function createSafe(address _account) public onlyGov {
        require(!safes[_account], "XVIX: account is already a safe");
        safes[_account] = true;

        uint256 balance = balances[_account];
        normalSupply = normalSupply.sub(balance);

        uint256 safeBalance = balance.mul(SAFE_DIVISOR).div(normalDivisor);
        balances[_account] = safeBalance;
        safeSupply = safeSupply.add(safeBalance);

        _ensureMaxSupply();
    }

    function destroySafe(address _account) public onlyGov onlyAfterHandover {
        require(safes[_account], "XVIX: account is not a safe");
        safes[_account] = false;

        uint256 balance = balances[_account];
        safeSupply = safeSupply.sub(balance);

        uint256 normalBalance = balance.mul(normalDivisor).div(SAFE_DIVISOR);
        balances[_account] = normalBalance;
        normalSupply = normalSupply.add(normalBalance);

        _ensureMaxSupply();
    }

    function setDefaultTransferConfig(
        uint256 _senderBurnBasisPoints,
        uint256 _senderFundBasisPoints,
        uint256 _receiverBurnBasisPoints,
        uint256 _receiverFundBasisPoints
    ) public onlyGov onlyAfterHandover {
        require(_senderBurnBasisPoints <= MAX_BURN_BASIS_POINTS, "XVIX: senderBurnBasisPoints exceeds limit");
        require(_senderFundBasisPoints <= MAX_FUND_BASIS_POINTS, "XVIX: senderFundBasisPoints exceeds limit");
        require(_receiverBurnBasisPoints <= MAX_BURN_BASIS_POINTS, "XVIX: receiverBurnBasisPoints exceeds limit");
        require(_receiverFundBasisPoints <= MAX_FUND_BASIS_POINTS, "XVIX: receiverFundBasisPoints exceeds limit");

        defaultSenderBurnBasisPoints = _senderBurnBasisPoints;
        defaultSenderFundBasisPoints = _senderFundBasisPoints;
        defaultReceiverBurnBasisPoints = _receiverBurnBasisPoints;
        defaultReceiverFundBasisPoints = _receiverFundBasisPoints;
    }

    function setRebaseConfig(
        uint256 _rebaseInterval,
        uint256 _rebaseBasisPoints
    ) public onlyGov onlyAfterHandover {
        require(_rebaseInterval >= MIN_REBASE_INTERVAL, "XVIX: rebaseInterval exceeds limit");
        require(_rebaseInterval <= MAX_REBASE_INTERVAL, "XVIX: rebaseInterval exceeds limit");
        require(_rebaseBasisPoints >= MIN_REBASE_BASIS_POINTS, "XVIX: rebaseBasisPoints exceeds limit");
        require(_rebaseBasisPoints <= MAX_REBASE_BASIS_POINTS, "XVIX: rebaseBasisPoints exceeds limit");

        rebaseInterval = _rebaseInterval;
        rebaseBasisPoints = _rebaseBasisPoints;
    }

    function createConfig(
        address _msgSender,
        uint256 _senderBurnBasisPoints,
        uint256 _senderFundBasisPoints,
        uint256 _receiverBurnBasisPoints,
        uint256 _receiverFundBasisPoints
    ) public onlyGov {
        require(_msgSender != address(0), "XVIX: cannot set zero address");
        require(_senderBurnBasisPoints <= MAX_BURN_BASIS_POINTS, "XVIX: senderBurnBasisPoints exceeds limit");
        require(_senderFundBasisPoints <= MAX_FUND_BASIS_POINTS, "XVIX: senderFundBasisPoints exceeds limit");
        require(_receiverBurnBasisPoints <= MAX_BURN_BASIS_POINTS, "XVIX: receiverBurnBasisPoints exceeds limit");
        require(_receiverFundBasisPoints <= MAX_FUND_BASIS_POINTS, "XVIX: receiverFundBasisPoints exceeds limit");

        transferConfigs[_msgSender] = TransferConfig(
            true,
            _senderBurnBasisPoints,
            _senderFundBasisPoints,
            _receiverBurnBasisPoints,
            _receiverFundBasisPoints
        );
    }

    function destroyConfig(address _msgSender) public onlyGov onlyAfterHandover {
        delete transferConfigs[_msgSender];
    }

    function rebase() public {
        if (block.timestamp < nextRebaseTime) { return; }
        // calculate the number of intervals that have passed
        uint256 timeDiff = block.timestamp.sub(nextRebaseTime);
        uint256 intervals = timeDiff.div(rebaseInterval).add(1);

        _setNextRebaseTime();

        uint256 multiplier = BASIS_POINTS_DIVISOR.add(rebaseBasisPoints) ** intervals;
        uint256 nextDivisor = normalDivisor.mul(multiplier).div(BASIS_POINTS_DIVISOR);
        if (nextDivisor > MAX_NORMAL_DIVISOR) {
            return;
        }

        normalDivisor = nextDivisor;
        emit Rebase(normalDivisor);
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

    function mint(address _account, uint256 _amount) public override returns (bool) {
        require(msg.sender == minter, "XVIX: forbidden");
        _mint(_account, _amount);
        return true;
    }

    // permanently remove tokens from circulation by reducing maxSupply
    function lock(uint256 _amount) public override returns (bool) {
        require(msg.sender == distributor, "XVIX: forbidden");
        if (_amount == 0) { return false; }

        _burn(msg.sender, _amount);
        maxSupply = maxSupply.sub(_amount);
        emit Lock(msg.sender, _amount, maxSupply);

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

    function adjustedNormalSupply() public view returns (uint256) {
        return normalSupply.div(normalDivisor);
    }

    function adjustedSafeSupply() public view returns (uint256) {
        return safeSupply.div(SAFE_DIVISOR);
    }

    function totalSupply() public view override returns (uint256) {
        return adjustedNormalSupply().add(adjustedSafeSupply());
    }

    function _setNextRebaseTime() private {
        uint256 roundedTime = block.timestamp.div(rebaseInterval).mul(rebaseInterval);
        nextRebaseTime = roundedTime.add(rebaseInterval);
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

    function _increaseBalance(address _account, uint256 _amount) private returns (uint256) {
        if (_amount == 0) { return 0; }

        if (safes[_account]) {
            uint256 adjustedAmount = _amount.mul(SAFE_DIVISOR);
            balances[_account] = balances[_account].add(adjustedAmount);
            safeSupply = safeSupply.add(adjustedAmount);
            _ensureMaxSupply();
            return adjustedAmount;
        }

        uint256 adjustedAmount = _amount.mul(normalDivisor);
        balances[_account] = balances[_account].add(adjustedAmount);
        normalSupply = normalSupply.add(adjustedAmount);
        _ensureMaxSupply();

        return adjustedAmount;
    }

    function _decreaseBalance(address _account, uint256 _amount) private returns (uint256) {
        if (_amount == 0) { return 0; }

        if (safes[_account]) {
            uint256 adjustedAmount = _amount.mul(SAFE_DIVISOR);
            balances[_account] = balances[_account].sub(adjustedAmount, "XVIX: subtraction amount exceeds balance");
            safeSupply = safeSupply.sub(adjustedAmount);
            return _amount;
        }

        uint256 adjustedAmount = _amount.mul(normalDivisor);
        balances[_account] = balances[_account].sub(adjustedAmount, "XVIX: subtraction amount exceeds balance");
        normalSupply = normalSupply.sub(adjustedAmount);

        return adjustedAmount;
    }

    function _ensureMaxSupply() private view {
        require(totalSupply() <= maxSupply, "XVIX: max supply exceeded");
    }

    function _emitFloorPrice() private {
        if (floor != address(0)) {
            emit FloorPrice(IFloor(floor).capital(), totalSupply());
        }
    }
}
