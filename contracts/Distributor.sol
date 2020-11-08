//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPool.sol";
import "./interfaces/ICafe.sol";
import "./interfaces/IMarket.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Factory.sol";


contract Distributor is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant FUND_BASIS_POINTS = 2000; // 20%
    uint256 public constant POOL_BASIS_POINTS = 5000; // 50%
    uint256 public constant LP_ETH_BASIS_POINTS = 2500; // 25%
    uint256 public constant LP_DAI_BASIS_POINTS = 2500; // 25%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    uint256 public constant MIN_RETURNS_BASIS_POINTS = 27500;

    address public immutable latte;
    address public immutable pool;
    address public immutable cafe;
    address public immutable market; // latte router
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
    uint256 public latteReceived;
    uint256 public ethLiquidity;
    uint256 public daiLiquidity;
    uint256 public ethReserve; // for cafe initialization

    mapping (address => uint256) public accountShares;
    uint256 public totalShares;

    bool public hasActiveLGE = true;

    event Lock(address indexed to, uint256 value);
    event WithdrawETH(address indexed to, uint256 value);

    constructor(
        address[] memory _addresses,
        uint256 _fundMax,
        uint256 _govStopTime
    ) public {
        latte = _addresses[0];
        pool = _addresses[1];
        cafe = _addresses[2];
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

        // allow market to spend latte
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

        ICafe(cafe).enableMint(ethReserve);

        latteReceived = IERC20(latte).balanceOf(address(this));
        _addLiquidityETH(_deadline);
        _addLiquidityDAI(_deadline);
    }

    function removeLiquidityETH(
        uint256 _shares,
        uint256 _amountLATTEMin,
        uint256 _amountETHMin,
        address _to,
        uint256 _deadline
    ) external nonReentrant {
        require(!hasActiveLGE, "Distributor: LGE has not ended");

        accountShares[msg.sender] = accountShares[msg.sender].sub(_shares);
        uint256 liquidity = ethLiquidity.mul(_shares).div(totalShares);

        (uint256 amountLATTE, uint256 amountETH) = IMarket(market).removeLiquidityETH(
            latte,
            liquidity,
            _amountLATTEMin,
            _amountETHMin,
            address(this),
            _deadline
        );

        uint256 refundBasisPoints = getRefundBasisPoints();
        uint256 refundAmount = amountLATTE.mul(refundBasisPoints).div(BASIS_POINTS_DIVISOR);
        uint256 lockAmount = amountLATTE.sub(refundAmount);

        ILatte(latte).lock(lockAmount);
        IPool(pool).refund(_to, refundAmount);

        (bool success,) = _to.call{value: amountETH}("");
        require(success, "Distributor: ETH transfer failed");

        emit WithdrawETH(_to, _shares);
    }

    /* function removeLiquidityDAI() external nonReentrant {
        require(!hasActiveLGE, "Distributor: LGE has not ended");

    } */

    function lock(uint256 _minDAI, uint256 _deadline) external payable nonReentrant {
        require(hasActiveLGE, "Distributor: LGE has ended");
        require(msg.value > 0, "Distributor: insufficient value");

        totalShares = totalShares.add(msg.value);
        accountShares[msg.sender] = accountShares[msg.sender].add(msg.value);

        uint256 remainingETH = msg.value;
        if (fundReceived >= fundMax) {
            uint256 fundETH = remainingETH.mul(FUND_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
            (bool success,) = fund.call{value: fundETH}("");
            require(success, "Distributor: transfer to fund failed");
            fundReceived = fundReceived.add(fundETH);
            remainingETH = remainingETH.sub(fundETH);
        }

        uint256 poolETH = remainingETH.mul(POOL_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        (bool success,) = pool.call{value: poolETH}("");
        require(success, "Distributor: transfer to pool failed");

        uint256 ethLpETH = remainingETH.mul(LP_ETH_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        uint256 daiLpETH = remainingETH.mul(LP_DAI_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);

        IUniswapV2Router(router).swapExactETHForTokens{value: daiLpETH}(
            _minDAI,
            path,
            address(this),
            _deadline
        );

        ethReserve = ethReserve.add(ethLpETH);

        emit Lock(msg.sender, msg.value);
    }

    function getRefundBasisPoints() public view returns (uint256) {
        address pair = IUniswapV2Factory(factory).getPair(latte, weth);
        uint256 wethBalance = IERC20(weth).balanceOf(pair);
        uint256 latteBalance = IERC20(latte).balanceOf(pair);
        // n represents the percentage, in basis points, that latte has risen
        // relative to eth
        uint256 a = totalShares.mul(latteBalance).mul(BASIS_POINTS_DIVISOR);
        uint256 b = latteReceived.mul(wethBalance);
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
        uint256 amountLatte = latteReceived.div(2);
        uint256 amountETH = address(this).balance;

        (, , uint256 liquidity) = IMarket(market).addLiquidityETH(
            latte, // token
            amountLatte, // amountTokenDesired
            amountLatte, // amountTokenMin
            amountETH, // amountETHMin
            address(this), // to
            _deadline // deadline
        );

        ethLiquidity = liquidity;
    }

    function _addLiquidityDAI(uint256 _deadline) private {
        uint256 amountLatte = latteReceived.div(2);
        uint256 amountDAI = IERC20(dai).balanceOf(address(this));

        (, , uint256 liquidity) = IMarket(market).addLiquidity(
            latte, // tokenA
            dai, // tokenB
            amountLatte, // amountADesired
            amountDAI, // amountBDesired
            amountLatte, // amountAMin
            amountDAI, // amountBMin
            address(this), // to
            _deadline // deadline
        );

        daiLiquidity = liquidity;
    }
}
