//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "../libraries/math/SafeMath.sol";
import "../interfaces/IPricer.sol";

contract PricerMock is IPricer {
    using SafeMath for uint256;

    uint224 private _lastPrice;
    bool private _hasIncreasingPrice;
    bool private _hasDecreasingPrice;

    constructor() public {}

    function update() external override returns (bool) {
        return true;
    }

    function lastPrice() external view override returns (uint224) {
        return _lastPrice;
    }

    function setLastPrice(uint224 _value) external {
        _lastPrice = _value;
    }

    function hasIncreasingPrice() external view override returns (bool) {
        return _hasIncreasingPrice;
    }

    function setIncreasingPrice(bool _value) external {
        _hasIncreasingPrice = _value;
    }

    function hasDecreasingPrice() external view override returns (bool) {
        return _hasDecreasingPrice;
    }

    function setDecreasingPrice(bool _value) external {
        _hasDecreasingPrice = _value;
    }
}
