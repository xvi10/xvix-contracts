//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPool.sol";


contract Cafe is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant PREMIUM_BASIS_POINTS = 500; // 5%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

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
        require(toMint > 0, "Cafe: mint amount is zero");

        ILatte(latte).mint(receiver, toMint);
        ethReserve = ethReserve.add(msg.value);
        tokenReserve = tokenReserve.sub(toMint);

        IPool(pool).fund{value: msg.value}();

        emit Mint(receiver, toMint);
    }

    function increaseTokenReserve(uint256 _amount) external nonReentrant returns (bool) {
        require(msg.sender == latte, "Cafe: forbidden");
        tokenReserve = tokenReserve.add(_amount);
        return true;
    }

    function getMintAmount(uint256 _ethAmount) public view returns (uint256) {
        uint256 k = ethReserve.mul(tokenReserve);
        uint256 a = k.div(ethReserve.add(_ethAmount));
        uint256 mintable = tokenReserve.sub(a);
        if (IPool(pool).capital() == 0) {
            return mintable;
        }

        // the maximum tokens that can be minted is capped by the price floor of the pool
        // this ensures that minting tokens will never reduce the price floor
        // the maximum tokens is also reduced by a premium so that the price floor will increase
        uint256 poolMax = IPool(pool).getMintAmount(_ethAmount);
        uint256 premium = poolMax.mul(PREMIUM_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        uint256 max = poolMax.sub(premium);
        return mintable < max ? mintable : max;
    }
}
