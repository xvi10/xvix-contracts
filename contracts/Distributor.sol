//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/ILGEToken.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IXVIX.sol";
import "./interfaces/IFloor.sol";
import "./interfaces/IMinter.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "@nomiclabs/buidler/console.sol";

contract Distributor is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant FLOOR_BASIS_POINTS = 5000;
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    bool public isInitialized;

    uint256 public lgeEndTime;
    uint256 public lpUnlockTime;
    uint256 public xvixRef;
    bool public lgeIsActive = true;

    address public xvix;
    address public weth;
    address public dai;
    address public lgeTokenWETH;
    address public lgeTokenDAI;
    address public floor;
    address public minter;
    address public router; // uniswap router
    address public factory; // uniswap factory
    address public gov;
    address[] public path;

    event Join(address indexed account, uint256 value);
    event RemoveLiquidity(address indexed to, address lgeToken, uint256 lgeTokenAmount);

    constructor() public {
        gov = msg.sender;
    }

    receive() external payable {
        assert(msg.sender == weth); // only accept ETH via fallback from the WETH contract
    }

    function initialize(
        address[] memory _addresses,
        uint256 _lgeEndTime,
        uint256 _lpUnlockTime
    ) public {
        require(msg.sender == gov, "Distributor: forbidden");
        require(!isInitialized, "Distributor: already initialized");
        isInitialized = true;

        xvix = _addresses[0];
        weth = _addresses[1];
        dai = _addresses[2];
        lgeTokenWETH = _addresses[3];
        lgeTokenDAI = _addresses[4];
        floor = _addresses[5];
        minter = _addresses[6];
        router = _addresses[7];
        factory = _addresses[8];

        require(ILGEToken(lgeTokenWETH).token() == weth, "Distributor: invalid lgeTokenWETH");
        require(ILGEToken(lgeTokenDAI).token() == dai, "Distributor: invalid lgeTokenDAI");

        path.push(weth);
        path.push(dai);

        lgeEndTime = _lgeEndTime;
        lpUnlockTime = _lpUnlockTime;
    }

    function join(address _receiver, uint256 _minDAI, uint256 _deadline) public payable nonReentrant {
        require(lgeIsActive, "Distributor: LGE has ended");
        require(msg.value > 0, "Distributor: insufficient value");

        uint256 floorETH = msg.value.mul(FLOOR_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        (bool success,) = floor.call{value: floorETH}("");
        require(success, "Distributor: transfer to floor failed");

        uint256 toSwap = msg.value.sub(floorETH).div(2);
        IUniswapV2Router(router).swapExactETHForTokens{value: toSwap}(
            _minDAI,
            path,
            address(this),
            _deadline
        );

        ILGEToken(lgeTokenWETH).mint(_receiver, msg.value);
        ILGEToken(lgeTokenDAI).mint(_receiver, msg.value);

        emit Join(_receiver, msg.value);
    }

    function endLGE(uint256 _deadline) public {
        require(lgeIsActive, "Distributor: LGE already ended");
        if (block.timestamp < lgeEndTime) {
            require(msg.sender == gov, "Distributor: forbidden");
        }

        lgeIsActive = false;

        // update the rebase divisor so that it will not suddenly increase
        // on the first XVIX transfer
        IXVIX(xvix).rebase();

        uint256 totalXVIX = IERC20(xvix).balanceOf(address(this));
        require(totalXVIX > 0, "Distributor: insufficient XVIX");

        uint256 amountXVIX = totalXVIX.div(2);

        _addLiquidityETH(_deadline, amountXVIX);
        _addLiquidityDAI(_deadline, amountXVIX);

        IMinter(minter).enableMint(ILGEToken(lgeTokenWETH).refBalance());
    }

    function removeLiquidityDAI(
        uint256 _lgeTokenAmount,
        uint256 _amountXVIXMin,
        uint256 _amountTokenMin,
        address _to,
        uint256 _deadline
    ) public {
        uint256 amountDAI = _removeLiquidity(
            lgeTokenDAI,
            _lgeTokenAmount,
            _amountXVIXMin,
            _amountTokenMin,
            _to,
            _deadline
        );

        IERC20(dai).transfer(_to, amountDAI);
    }

    function removeLiquidityETH(
        uint256 _lgeTokenAmount,
        uint256 _amountXVIXMin,
        uint256 _amountTokenMin,
        address _to,
        uint256 _deadline
    ) public {
        uint256 amountWETH = _removeLiquidity(
            lgeTokenWETH,
            _lgeTokenAmount,
            _amountXVIXMin,
            _amountTokenMin,
            _to,
            _deadline
        );

        IWETH(weth).withdraw(amountWETH);
        (bool success,) = _to.call{value: amountWETH}("");
        require(success, "Distributor: ETH transfer failed");
    }

    function _removeLiquidity(
        address _lgeToken,
        uint256 _lgeTokenAmount,
        uint256 _amountXVIXMin,
        uint256 _amountTokenMin,
        address _to,
        uint256 _deadline
    ) private nonReentrant returns (uint256) {
        require(block.timestamp >= lpUnlockTime, "Distributor: unlock time not yet reached");

        uint256 liquidity = _getLiquidityAmount(_lgeToken, _lgeTokenAmount);
        ILGEToken(_lgeToken).burn(msg.sender, _lgeTokenAmount);

        (uint256 amountXVIX, uint256 amountToken) = IUniswapV2Router(router).removeLiquidity(
            xvix,
            ILGEToken(_lgeToken).token(),
            liquidity,
            _amountXVIXMin,
            _amountTokenMin,
            address(this),
            _deadline
        );

        uint256 refundBasisPoints = _getRefundBasisPoints(_lgeToken, _lgeTokenAmount, amountToken);
        uint256 refundAmount = amountXVIX.mul(refundBasisPoints).div(BASIS_POINTS_DIVISOR);

        IFloor(floor).refund(_to, refundAmount);

        uint256 toastAmount = amountXVIX.sub(refundAmount);
        IXVIX(xvix).toast(toastAmount);

        emit RemoveLiquidity(_to, _lgeToken, _lgeTokenAmount);

        return amountToken;
    }

    function _getRefundBasisPoints(
        address _lgeToken,
        uint256 _lgeTokenAmount,
        uint256 _amountToken
    ) private view returns (uint256) {
        uint256 refBalance = ILGEToken(_lgeToken).refBalance();
        uint256 refSupply = ILGEToken(_lgeToken).refSupply();
        // refAmount is the amount of WETH or DAI that would be returned
        // if there was no change in the price of XVIX
        uint256 refAmount = _lgeTokenAmount.mul(refBalance).div(refSupply);

        // for simplicity, we assume that the floor received 50% of ETH
        // and that the remaining ETH received was split equally between WETH and DAI
        // so the refund basis points would be zero if _amountToken >= refAmount * 2
        uint256 minExpectedAmount = refAmount.mul(2);

        if (_amountToken >= minExpectedAmount) {
            return 0;
        }

        uint256 diff = minExpectedAmount.sub(_amountToken);
        uint256 refundBasisPoints = diff.mul(BASIS_POINTS_DIVISOR).div(refAmount);

        if (refundBasisPoints >= BASIS_POINTS_DIVISOR) {
            return BASIS_POINTS_DIVISOR;
        }

        return refundBasisPoints;
    }

    function _getLiquidityAmount(address _lgeToken, uint256 _lgeTokenAmount) private view returns (uint256) {
        address pair = IUniswapV2Factory(factory).getPair(xvix, ILGEToken(_lgeToken).token());
        uint256 pairBalance = IERC20(pair).balanceOf(address(this));
        uint256 totalSupply = IERC20(_lgeToken).totalSupply();
        return pairBalance.mul(_lgeTokenAmount).div(totalSupply);
    }

    function _addLiquidityETH(uint256 _deadline, uint256 _amountXVIX) private {
        uint256 amountETH = address(this).balance;
        require(amountETH > 0, "Distributor: insufficient ETH");

        IERC20(xvix).approve(router, _amountXVIX);

        IUniswapV2Router(router).addLiquidityETH{value: amountETH}(
            xvix, // token
            _amountXVIX, // amountTokenDesired
            0, // amountTokenMin
            0, // amountETHMin
            address(this), // to
            _deadline // deadline
        );

        ILGEToken(lgeTokenWETH).setRefBalance(amountETH);
        uint256 totalSupply = IERC20(lgeTokenWETH).totalSupply();
        ILGEToken(lgeTokenWETH).setRefSupply(totalSupply);
    }

    function _addLiquidityDAI(uint256 _deadline, uint256 _amountXVIX) private {
        uint256 amountDAI = IERC20(dai).balanceOf(address(this));
        require(amountDAI > 0, "Distributor: insufficient DAI");

        IERC20(xvix).approve(router, _amountXVIX);
        IERC20(dai).approve(router, amountDAI);

        IUniswapV2Router(router).addLiquidity(
            xvix, // tokenA
            dai, // tokenB
            _amountXVIX, // amountADesired
            amountDAI, // amountBDesired
            0, // amountAMin
            0, // amountBMin
            address(this), // to
            _deadline // deadline
        );

        ILGEToken(lgeTokenDAI).setRefBalance(amountDAI);
        uint256 totalSupply = IERC20(lgeTokenDAI).totalSupply();
        ILGEToken(lgeTokenDAI).setRefSupply(totalSupply);
    }
}
