//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPricer.sol";
import "./interfaces/IPool.sol";


contract Cafe is ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant MINTABLE_BASIS_POINTS = 50; // 0.5%
    uint256 public constant MAX_FEE_BASIS_POINTS = 500; // 5%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    address public immutable latte;
    address public immutable pricer;
    address public immutable shopper;
    address public immutable pool;

    address public gov;
    address public cashier;
    uint256 public feeBasisPoints = 100; // 1%

    event Mint(address indexed to, uint256 value);

    constructor(address _latte, address _pricer, address _shopper, address _pool) public {
        latte = _latte;
        pricer = _pricer;
        shopper = _shopper;
        pool = _pool;
        gov = msg.sender;
        cashier = msg.sender;
    }

    function setCashier(address _cashier) external {
        require(msg.sender == gov, "Cafe: forbidden");
        cashier = _cashier;
    }

    function setGov(address _gov) external {
        require(msg.sender == gov, "Cafe: forbidden");
        gov = _gov;
    }

    function setFee(uint256 _basisPoints) external {
        require(msg.sender == gov, "Cafe: forbidden");
        require(_basisPoints <= MAX_FEE_BASIS_POINTS, "Cafe: fee exceeds allowed limit");
        feeBasisPoints = _basisPoints;
    }

    function mint(address receiver) external payable nonReentrant returns (bool) {
        require(msg.value > 0, "Cafe: insufficient value in");

        uint256 maxMintable = getMaxMintableAmount();
        require(maxMintable > 0, "Cafe: latte fully sold");

        uint256 toMint = IPricer(pricer).tokensForEth(msg.value);
        require(toMint > 0, "Cafe: sell price not available");

        require(toMint <= maxMintable, "Cafe: amount to sell exceeds allowed limit");

        ILatte(latte).mint(receiver, toMint);

        uint256 shopperBasisPoints = BASIS_POINTS_DIVISOR.sub(feeBasisPoints).div(2);
        uint256 toShopper = msg.value.mul(shopperBasisPoints).div(BASIS_POINTS_DIVISOR);
        uint256 toPool = toShopper;
        uint256 toCashier = msg.value.sub(toShopper).sub(toPool);

        (bool success,) = shopper.call{value: toShopper}("");
        require(success, "Cafe: transfer to shopper failed");

        IPool(pool).fund{value: toPool}();

        (success,) = cashier.call{value: toCashier}("");
        require(success, "Cafe: transfer to cashier failed");

        emit Mint(receiver, toMint);
    }

    function getMaxMintableAmount() public view returns (uint256) {
        if (!IPricer(pricer).hasIncreasingPrice()) {
            return 0;
        }

        uint256 supply = ILatte(latte).supplySnapshot();
        uint256 mintable = supply.mul(MINTABLE_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        uint256 maxSupply = supply.add(mintable);
        uint256 currentSupply = IERC20(latte).totalSupply();

        if (currentSupply >= maxSupply) {
            return 0;
        }

        return maxSupply.sub(currentSupply);
    }
}
