//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./Latte.sol";

contract Pricer {
    using SafeMath for uint256;

    uint256 public constant MIN_INTERVAL = 30 minutes;

    address public immutable latte;
    address public immutable pair;
    bool public immutable use0;

    uint256 public p0;
    uint256 public p1;

    uint32 public t0; // // uses single storage slot
    uint32 public t1; // // uses single storage slot
    uint32 public lastBlockTime; // // uses single storage slot
    bool private _increasingPrice; // // uses single storage slot
    bool private _decreasingPrice; // // uses single storage slot
    uint224 private _lastPrice;

    constructor(address _latte, address _pair) public {
        latte = _latte;
        pair = _pair;

        address token0 = IUniswapV2Pair(_pair).token0();
        address token1 = IUniswapV2Pair(_pair).token1();
        require(token0 == _latte || token1 == _latte, "Pricer: invalid pair");
        use0 = token0 == _latte;
    }

    function update() external {
        (, , uint32 t2) = IUniswapV2Pair(pair).getReserves();
        bool inNextInterval = t2 - lastBlockTime > MIN_INTERVAL; // overflow is desired
        if (!inNextInterval) {
            return;
        }

        uint256 p2 = _currentPrice();
        uint224 averagePrice0;
        uint224 averagePrice1;
        if (p0 != 0 && p1 != 0) {
            averagePrice0 = uint224((p1 - p0) / (t1 - t0)); // overflow is desired
            averagePrice1 = uint224((p2 - p1) / (t2 - t1)); // overflow is desired
            _updatePriceDirection(averagePrice0, averagePrice1);
        }

        p0 = p1;
        p1 = p2;
        t0 = t1;
        t1 = t2;
        lastBlockTime = t2;
        _lastPrice = averagePrice1;
    }

    function lastPrice() external view returns (uint224) {
        return _lastPrice;
    }

    function hasIncreasingPrice() external view returns (bool) {
        return _increasingPrice;
    }

    function hasDecreasingPrice() external view returns (bool) {
        return _decreasingPrice;
    }

    function _updatePriceDirection(uint224 averagePrice0, uint224 averagePrice1) private {
        if (averagePrice0 == averagePrice1) {
            _increasingPrice = false;
            _decreasingPrice = false;
            return;
        }

        if (averagePrice0 < averagePrice1) {
            _increasingPrice = true;
            _decreasingPrice = false;
            return;
        }

        _increasingPrice = false;
        _decreasingPrice = true;
    }

    function _currentPrice() private view returns (uint256) {
        return use0 ? IUniswapV2Pair(pair).price0CumulativeLast() : IUniswapV2Pair(pair).price1CumulativeLast();
    }
}
