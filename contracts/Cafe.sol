//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPool.sol";


contract Cafe is ReentrancyGuard {
    using SafeMath for uint256;

    address public immutable latte;
    address public immutable pool;

    uint256 public ethReserve;
    uint256 public tokenReserve;

    event Mint(address indexed to, uint256 value);

    constructor(address _latte, address _pool, uint256 _ethReserve, uint256 _tokenReserve) public {
        latte = _latte;
        pool = _pool;
        ethReserve = _ethReserve;
        tokenReserve = _tokenReserve;
    }

    function mint(address receiver) external payable nonReentrant {
        require(msg.value > 0, "Cafe: insufficient value in");

        uint256 toMint = getMintAmount(msg.value);
        ILatte(latte).mint(receiver, toMint);
        ethReserve = ethReserve.add(msg.value);
        tokenReserve = tokenReserve.sub(toMint);

        IPool(pool).fund{value: msg.value}();

        emit Mint(receiver, toMint);
    }

    function increaseTokenReserve(uint256 _amount) external nonReentrant returns (bool) {
        require(msg.sender == latte, "Cafe: forbidden");

        uint256 totalSupply = IERC20(latte).totalSupply();
        uint256 capital = IPool(pool).capital();
        uint256 newTokenReserve = tokenReserve.add(_amount);
        if (ethReserve.mul(totalSupply) < capital.mul(newTokenReserve)) {
            return false;
        }

        tokenReserve = newTokenReserve;
        return true;
    }

    function getMintAmount(uint256 _amountIn) public view returns (uint256) {
        uint256 k = ethReserve.mul(tokenReserve);
        uint256 a = k.div(ethReserve.add(_amountIn));
        return tokenReserve.sub(a);
    }
}
