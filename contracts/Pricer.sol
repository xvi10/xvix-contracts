//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IPricer.sol";


contract Pricer is IPricer {
    using SafeMath for uint256;

    uint256 public constant MIN_INTERVAL = 30 minutes;
    uint256 public constant Q112 = 2**112; // uniswap price multiplier

    address public immutable pair; // address of uniswap pair
    bool public immutable use0; // true if token0 of the uniswap pair is latte

    // n is the current interval
    uint256 public cp0; // cumulative price at interval n-2
    uint256 public cp1; // cumulative price at interval n-1

    // uses single storage slot
    uint32 private _t0; // start time of interval n-2
    uint32 private _t1; // start time of interval n-1
    bool private _hasIncreasingPrice;
    bool private _hasDecreasingPrice;

    // records p * Q112, where 1 latte = p eth
    uint224 private _lastPrice;

    event Update(uint256 averagePrice0, uint256 averagePrice1);

    constructor(address _pair, address _latte) public {
        pair = _pair;

        address token0 = IUniswapV2Pair(_pair).token0();
        address token1 = IUniswapV2Pair(_pair).token1();
        require(token0 == _latte || token1 == _latte, "Pricer: invalid pair");
        use0 = token0 == _latte;
    }

    function update() external override returns (bool) {
        uint32 t2 = getLastTradedTime();
        if (t2 == 0) {
            return false;
        }

        bool inNextInterval = t2 - _t1 > MIN_INTERVAL; // overflow is desired
        if (!inNextInterval) {
            return false;
        }

        uint256 cp2 = _currentCumulativePrice();
        if (cp2 == 0) {
            return false;
        }

        uint224 averagePrice0;
        uint224 averagePrice1;

        if (cp0 != 0 && cp1 != 0) {
            averagePrice0 = uint224((cp1 - cp0) / (_t1 - _t0)); // overflow is desired
            averagePrice1 = uint224((cp2 - cp1) / (t2 - _t1)); // overflow is desired
            _updatePricingDirections(averagePrice0, averagePrice1);
            emit Update(averagePrice0, averagePrice1);
        }

        cp0 = cp1;
        cp1 = cp2;
        _t0 = _t1;
        _t1 = t2;
        _lastPrice = averagePrice1;

        return true;
    }

    function t0() external view returns (uint32) {
        return _t0;
    }

    function t1() external view returns (uint32) {
        return _t1;
    }

    function lastPrice() external view override returns (uint224) {
        return _lastPrice;
    }

    function hasIncreasingPrice() external view override returns (bool) {
        if (hasStalePricing()) {
            return false;
        }

        return _hasIncreasingPrice;
    }

    function hasDecreasingPrice() external view override returns (bool) {
        if (hasStalePricing()) {
            return false;
        }

        return _hasDecreasingPrice;
    }

    function tokensForEth(uint256 amountIn) external view override returns (uint256) {
        if (_lastPrice == 0) {
            return 0;
        }
        return amountIn.mul(Q112).div(_lastPrice);
    }

    function ethForTokens(uint256 amountIn) external view override returns (uint256) {
        if (_lastPrice == 0) {
            return 0;
        }
        return amountIn.mul(_lastPrice).div(Q112);
    }

    function hasStalePricing() public view returns (bool) {
        uint32 lastTradedTime = getLastTradedTime();
        uint32 blockTime = uint32(block.timestamp % 2 ** 32);
        return blockTime - lastTradedTime > MIN_INTERVAL; // overflow is desired
    }

    function getLastTradedTime() public view returns (uint32) {
        (, , uint32 time) = IUniswapV2Pair(pair).getReserves();
        return time;
    }

    function _updatePricingDirections(uint224 averagePrice0, uint224 averagePrice1) private {
        if (averagePrice0 == averagePrice1) {
            _hasIncreasingPrice = false;
            _hasDecreasingPrice = false;
            return;
        }

        if (averagePrice0 < averagePrice1) {
            _hasIncreasingPrice = true;
            _hasDecreasingPrice = false;
            return;
        }

        _hasIncreasingPrice = false;
        _hasDecreasingPrice = true;
    }

    // returns p * Q112, where 1 latte = p eth
    function _currentCumulativePrice() private view returns (uint256) {
        return use0 ? IUniswapV2Pair(pair).price0CumulativeLast() : IUniswapV2Pair(pair).price1CumulativeLast();
    }
}
