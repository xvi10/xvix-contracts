//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPricer.sol";

contract Shopper {
    using SafeMath for uint256;

    uint256 public constant BURNABLE_BASIS_POINTS = 50; // 0.5%
    uint256 public constant MAX_FEE_BASIS_POINTS = 500; // 5%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    address public latte;
    address public pricer;
    address public shopper;

    address public gov;
    address public cashier;
    uint256 public feeBasisPoints = 100; // 1%

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

    function setFee(uint256 _basisPoints) external {
        require(msg.sender == gov, "Shopper: forbidden");
        require(_basisPoints <= MAX_FEE_BASIS_POINTS, "Shopper: fee exceeds allowed limit");
        feeBasisPoints = _basisPoints;
    }

    function getMaxBurnableAmount() public view returns (uint256) {
        uint256 supply = ILatte(latte).supplySnapshot();
        uint256 delta = supply.mul(BURNABLE_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        uint256 minSupply = supply.sub(delta);
        uint256 currentSupply = IERC20(latte).totalSupply();
        if (currentSupply <= minSupply) {
            return 0;
        }
        return currentSupply.sub(minSupply);
    }

    function burn(uint256 tokensIn) external payable returns (bool) {
        require(tokensIn > 0, "Shopper: insufficient value in");
        require(IPricer(pricer).hasDecreasingPrice(), "Shopper: not open for buying");

        uint256 maxBurnable = getMaxBurnableAmount();
        require(maxBurnable > 0, "Shopper: latte fully bought");
        require(tokensIn <= maxBurnable, "Shopper: amount to buy exceeds allowed limit");

        uint256 amountETH = IPricer(pricer).ethForTokens(tokensIn);
        require(amountETH > 0, "Shopper: buy price not available");
        require(amountETH <= address(this).balance, "Shopper: insufficient ETH to fulfill request");

        uint256 burnBasisPoints = BASIS_POINTS_DIVISOR.sub(feeBasisPoints);
        uint256 toBurn = tokensIn.mul(burnBasisPoints).div(BASIS_POINTS_DIVISOR);
        ILatte(latte).burn(msg.sender, toBurn);

        uint256 toCashier = tokensIn.sub(toBurn);
        IERC20(latte).transferFrom(msg.sender, cashier, toCashier);

        (bool success,  ) = msg.sender.call{value: amountETH}("");
        require(success, "Pool: transfer failed");
    }

    receive() external payable {}
}
