//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPricer.sol";

contract Shopper {
    using SafeMath for uint256;

    uint256 public constant BURNABLE_BASIS_POINTS = 50;
    uint256 public constant FEE_BASIS_POINTS = 100;
    uint256 public constant MAX_BASIS_POINTS = 10000;

    address public latte;
    address public pricer;
    address public gov;

    address public shopper;
    address public reserve;
    address public cashier;

    constructor(address _latte, address _pricer) public {
        latte = _latte;
        pricer = _pricer;
        gov = msg.sender;
        cashier = msg.sender;
    }

    function setCashier(address _cashier) external {
        require(msg.sender == gov, "Shopper: forbidden");
        cashier = _cashier;
    }

    function setGov(address _gov) external {
        require(msg.sender == gov, "Shopper: forbidden");
        gov = _gov;
    }

    function getMaxBurnableAmount() public view returns (uint256) {
        uint256 supply = ILatte(latte).supplySnapshot();
        uint256 delta = supply.mul(BURNABLE_BASIS_POINTS).div(MAX_BASIS_POINTS);
        uint256 minSupply = supply.sub(delta);
        uint256 currentSupply = IERC20(latte).totalSupply();
        if (currentSupply <= minSupply) {
            return 0;
        }
        return currentSupply.sub(minSupply);
    }

    function burn(uint256 tokensIn) external payable returns (bool) {
        require(tokensIn > 0, "Shopper: insufficient value");
        require(!IPricer(pricer).hasDecreasingPrice(), "Shopper: not open for buying");

        uint256 maxBurnable = getMaxBurnableAmount();
        require(maxBurnable > 0, "Shopper: latte fully bought");
        require(tokensIn <= maxBurnable, "Shopper: amount to buy exceeds allowed limit");

        uint256 amountETH = IPricer(pricer).ethForTokens(tokensIn);
        require(amountETH > 0, "Shopper: buy price not available");
        require(amountETH <= address(this).balance, "Shopper: insufficient ETH to fulfill request");

        uint256 burnBasisPoints = MAX_BASIS_POINTS.sub(FEE_BASIS_POINTS);
        uint256 toBurn = tokensIn.mul(burnBasisPoints).div(MAX_BASIS_POINTS);
        ILatte(latte).burn(msg.sender, toBurn);

        uint256 toCashier = tokensIn.sub(toBurn);
        IERC20(latte).transferFrom(msg.sender, cashier, toCashier);

        address(uint160(msg.sender)).transfer(amountETH);
    }
}
