//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./uniswap/UniswapV2Library.sol";
import "./libraries/token/IERC20.sol";

contract Reader {
    using SafeMath for uint256;

    address public immutable factory;
    address public immutable xvix;
    address public immutable dai;
    address public immutable lgeTokenWETH;
    address public immutable distributor;

    constructor(
        address _factory,
        address _xvix,
        address _dai,
        address _lgeTokenWETH,
        address _distributor
    ) public {
        factory = _factory;
        xvix = _xvix;
        dai = _dai;
        lgeTokenWETH = _lgeTokenWETH;
        distributor = _distributor;
    }

    function getPoolAmounts(
        address _account,
        address _token0,
        address _token1
    ) external view returns (uint256, uint256, uint256, uint256, uint256) {
        address pair = UniswapV2Library.pairFor(factory, _token0, _token1);
        uint256 supply = IERC20(pair).totalSupply();
        if (supply == 0) {
            return (0, 0, 0, 0, 0);
        }
        uint256 accountBalance = IERC20(pair).balanceOf(_account);
        uint256 balance0 = IERC20(_token0).balanceOf(pair);
        uint256 balance1 = IERC20(_token1).balanceOf(pair);
        uint256 pool0 = balance0.mul(accountBalance).div(supply);
        uint256 pool1 = balance1.mul(accountBalance).div(supply);
        return (pool0, pool1, balance0, balance1, supply);
    }

    function getLGEAmounts(address _account) public view returns (uint256, uint256, uint256, uint256) {
        uint256 accountBalance = IERC20(lgeTokenWETH).balanceOf(_account);
        uint256 supply = IERC20(lgeTokenWETH).totalSupply();
        if (supply == 0) {
            return (0, 0, 0, 0);
        }

        return (
            accountBalance,
            distributor.balance.mul(accountBalance).div(supply),
            IERC20(dai).balanceOf(distributor).mul(accountBalance).div(supply),
            IERC20(xvix).balanceOf(distributor).mul(accountBalance).div(supply)
        );
    }
}
