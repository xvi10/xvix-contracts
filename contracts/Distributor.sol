//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/IXVIX.sol";
import "./interfaces/IFloor.sol";
import "./interfaces/IMinter.sol";
import "./interfaces/IMarket.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Factory.sol";


contract Distributor is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant FUND_BASIS_POINTS = 2000; // 20%
    uint256 public constant FLOOR_BASIS_POINTS = 5000; // 50%
    uint256 public constant LP_ETH_BASIS_POINTS = 2500; // 25%
    uint256 public constant LP_DAI_BASIS_POINTS = 2500; // 25%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    uint256 public constant MIN_RETURNS_BASIS_POINTS = 27500;

    address public immutable xvix;
    address public immutable floor;
    address public immutable minter;
    address public immutable market; // xvix router
    address public immutable router; // uniswap router
    address public immutable factory; // uniswap factory
    address public immutable weth;
    address public immutable dai;
    address public immutable fund; // marketing / dev fund
    uint256 public immutable fundMax;
    address public immutable gov;
    address[] public path;

    uint256 public govStopTime;
    uint256 public fundReceived;
    uint256 public xvixReceived;
    uint256 public ethLiquidity;
    uint256 public daiLiquidity;

    mapping (address => uint256) public sharesETH;
    mapping (address => uint256) public sharesDAI;

    uint256 public ethLpXVIX;
    uint256 public daiLpXVIX;

    uint256 public lpTotalETH;
    uint256 public lpTotalDAI;

    bool public hasActiveLGE = true;

    event Lock(address indexed to, uint256 value);
    event WithdrawETH(address indexed to, uint256 value);
    event WithdrawDAI(address indexed to, uint256 value);

    constructor(
        address[] memory _addresses,
        uint256 _fundMax,
        uint256 _govStopTime
    ) public {
        xvix = _addresses[0];
        floor = _addresses[1];
        minter = _addresses[2];
        market = _addresses[3];
        router = _addresses[4];
        factory = _addresses[5];
        weth = _addresses[6];
        dai = _addresses[7];
        fund = _addresses[8];
        fundMax = _fundMax;
        govStopTime = _govStopTime;

        path.push(_addresses[6]); // weth
        path.push(_addresses[7]); // dai

        // allow market to spend xvix
        IERC20(_addresses[0]).approve(_addresses[3], uint256(-1));
        // allow market to spend dai
        IERC20(_addresses[7]).approve(_addresses[3], uint256(-1));

        gov = msg.sender;
    }

    function endLGE(uint256 _deadline) external nonReentrant {
        require(hasActiveLGE, "Distributor: LGE has ended");
        // validate gov if govStopTime has not been reached
        if (block.timestamp < govStopTime) {
            require(msg.sender == gov, "Distributor: forbidden");
        }
        hasActiveLGE = false;

        uint256 xvixBalance = IERC20(xvix).balanceOf(address(this));
        ethLpXVIX = xvixBalance.div(2);
        daiLpXVIX = xvixBalance.sub(ethLpXVIX);

        _addLiquidityETH(_deadline);
        _addLiquidityDAI(_deadline);
    }

    function removeLiquidityETH(
        uint256 _shares,
        uint256 _amountXVIXMin,
        uint256 _amountETHMin,
        address _to,
        uint256 _deadline
    ) external nonReentrant {
        require(!hasActiveLGE, "Distributor: LGE has not ended");

        sharesETH[msg.sender] = sharesETH[msg.sender].sub(_shares);
        uint256 liquidity = ethLiquidity.mul(_shares).div(lpTotalETH);

        (uint256 amountXVIX, uint256 amountETH) = IMarket(market).removeLiquidityETH(
            xvix,
            liquidity,
            _amountXVIXMin,
            _amountETHMin,
            address(this),
            _deadline
        );

        uint256 refundBasisPoints = getRefundBasisPoints();
        uint256 refundAmount = amountXVIX.mul(refundBasisPoints).div(BASIS_POINTS_DIVISOR);

        IFloor(floor).refund(_to, refundAmount);

        (bool success,) = _to.call{value: amountETH}("");
        require(success, "Distributor: ETH transfer failed");

        emit WithdrawETH(_to, _shares);
    }

    function removeLiquidityDAI(
        uint256 _shares,
        uint256 _amountXVIXMin,
        uint256 _amountDAIMin,
        address _to,
        uint256 _deadline
    ) external nonReentrant {
        require(!hasActiveLGE, "Distributor: LGE has not ended");

        sharesDAI[msg.sender] = sharesDAI[msg.sender].sub(_shares);
        uint256 liquidity = daiLiquidity.mul(_shares).div(lpTotalDAI);

        (uint256 amountXVIX, uint256 amountDAI) = IMarket(market).removeLiquidity(
            xvix,
            dai,
            liquidity,
            _amountXVIXMin,
            _amountDAIMin,
            address(this),
            _deadline
        );

        IERC20(dai).transfer(_to, amountDAI);

        uint256 refundBasisPoints = getRefundBasisPoints();
        uint256 refundAmount = amountXVIX.mul(refundBasisPoints).div(BASIS_POINTS_DIVISOR);

        IFloor(floor).refund(_to, refundAmount);

        emit WithdrawDAI(_to, _shares);
    }

    function lock(uint256 _minDAI, uint256 _deadline) external payable nonReentrant {
        require(hasActiveLGE, "Distributor: LGE has ended");
        require(msg.value > 0, "Distributor: insufficient value");

        uint256 remainingETH = msg.value;
        if (fundReceived >= fundMax) {
            uint256 fundETH = remainingETH.mul(FUND_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
            (bool success,) = fund.call{value: fundETH}("");
            require(success, "Distributor: transfer to fund failed");
            fundReceived = fundReceived.add(fundETH);
            remainingETH = remainingETH.sub(fundETH);
        }

        uint256 floorETH = remainingETH.mul(FLOOR_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        (bool success,) = floor.call{value: floorETH}("");
        require(success, "Distributor: transfer to floor failed");

        uint256 ethLpETH = remainingETH.mul(LP_ETH_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        uint256 daiLpETH = remainingETH.mul(LP_DAI_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);

        uint256[] memory amounts = IUniswapV2Router(router).swapExactETHForTokens{value: daiLpETH}(
            _minDAI,
            path,
            address(this),
            _deadline
        );

        uint256 daiLpDAI = amounts[amounts.length - 1];

        sharesETH[msg.sender] = sharesETH[msg.sender].add(ethLpETH);
        sharesDAI[msg.sender] = sharesETH[msg.sender].add(daiLpDAI);

        lpTotalETH = lpTotalETH.add(ethLpETH);
        lpTotalDAI = lpTotalDAI.add(daiLpDAI);

        emit Lock(msg.sender, msg.value);
    }

    function getRefundBasisPoints() public view returns (uint256) {
        address pair = IUniswapV2Factory(factory).getPair(xvix, weth);
        uint256 wethBalance = IERC20(weth).balanceOf(pair);
        uint256 xvixBalance = IERC20(xvix).balanceOf(pair);
        // n represents the percentage, in basis points, that xvix has risen
        // relative to eth
        uint256 a = lpTotalETH.mul(xvixBalance).mul(BASIS_POINTS_DIVISOR);
        uint256 b = xvixReceived.div(2).mul(wethBalance);
        uint256 n = a.div(b);
        if (n >= MIN_RETURNS_BASIS_POINTS) {
            return 0;
        }
        uint256 refundBasisPoints = MIN_RETURNS_BASIS_POINTS.sub(n);
        if (refundBasisPoints > BASIS_POINTS_DIVISOR) {
            return BASIS_POINTS_DIVISOR;
        }

        return refundBasisPoints;
    }

    function _addLiquidityETH(uint256 _deadline) private {
        uint256 amountXVIX = xvixReceived.div(2);
        uint256 amountETH = address(this).balance;

        (, , uint256 liquidity) = IMarket(market).addLiquidityETH(
            xvix, // token
            amountXVIX, // amountTokenDesired
            amountXVIX, // amountTokenMin
            amountETH, // amountETHMin
            address(this), // to
            _deadline // deadline
        );

        ethLiquidity = liquidity;
    }

    function _addLiquidityDAI(uint256 _deadline) private {
        uint256 amountXVIX = xvixReceived.div(2);
        uint256 amountDAI = IERC20(dai).balanceOf(address(this));

        (, , uint256 liquidity) = IMarket(market).addLiquidity(
            xvix, // tokenA
            dai, // tokenB
            amountXVIX, // amountADesired
            amountDAI, // amountBDesired
            amountXVIX, // amountAMin
            amountDAI, // amountBMin
            address(this), // to
            _deadline // deadline
        );

        daiLiquidity = liquidity;
    }
}
