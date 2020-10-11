//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IPricer.sol";

contract Pricer is IPricer {
    using SafeMath for uint256;

    uint256 public constant MIN_INTERVAL = 30 minutes;

    address public immutable pair;
    bool public immutable use0;

    uint256 public p0;
    uint256 public p1;

    uint32 private _t0; // uses single storage slot
    uint32 private _t1; // uses single storage slot
    bool private _hasIncreasingPrice; // uses single storage slot
    bool private _hasDecreasingPrice; // uses single storage slot

    uint224 private _lastPrice;

    constructor(address _pair, address _latte) public {
        pair = _pair;

        address token0 = IUniswapV2Pair(_pair).token0();
        address token1 = IUniswapV2Pair(_pair).token1();
        require(token0 == _latte || token1 == _latte, "Pricer: invalid pair");
        use0 = token0 == _latte;
    }

    function update() external override returns (bool) {
        uint32 t2 = getLastBlockTime();
        if (t2 == 0) {
            return false;
        }

        bool inNextInterval = t2 - _t1 > MIN_INTERVAL; // overflow is desired
        if (!inNextInterval) {
            return false;
        }

        uint256 p2 = _currentPrice();
        if (p2 == 0) {
            return false;
        }

        uint224 averagePrice0;
        uint224 averagePrice1;
        if (p0 != 0 && p1 != 0) {
            averagePrice0 = uint224((p1 - p0) / (_t1 - _t0)); // overflow is desired
            averagePrice1 = uint224((p2 - p1) / (t2 - _t1)); // overflow is desired
            _updatePricingDirections(averagePrice0, averagePrice1);
        }

        p0 = p1;
        p1 = p2;
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

    function hasStalePricing() public view returns (bool) {
        uint32 lastBlockTime = getLastBlockTime();
        uint32 blockTime = uint32(block.timestamp % 2 ** 32);
        return blockTime - lastBlockTime > MIN_INTERVAL; // overflow is desired
    }

    function getLastBlockTime() public view returns (uint32) {
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

    function _currentPrice() private view returns (uint256) {
        return use0 ? IUniswapV2Pair(pair).price0CumulativeLast() : IUniswapV2Pair(pair).price1CumulativeLast();
    }
}
