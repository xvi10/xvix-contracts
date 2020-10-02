//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./Latte.sol";

contract Pricer {
    using SafeMath for uint256;

    struct Price {
        uint256 eth;
        uint256 latte;
    }

    address public latte;
    Price public price0;
    Price public price1;
    Price public price2;

    constructor(address _latte) public {
        latte = _latte;
    }

    function _cmp(Price memory priceA, Price memory priceB) private pure returns (uint256) {
        // p.latte and p.eth values are originally of type uint112
        // so `mul` should not overflow
        uint256 s0 = priceA.latte.mul(priceB.eth);
        uint256 s1 = priceB.latte.mul(priceA.eth);
        if (s0 == s1) {
            return 0;
        }
        if (s0 < s1) {
            return 1;
        }
        return 2;
    }
}
