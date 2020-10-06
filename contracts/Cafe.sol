//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPricer.sol";
import "./interfaces/IPool.sol";

contract Cafe {
    using SafeMath for uint256;

    uint256 public constant MINTABLE_BASIS_POINTS = 20;
    uint256 public constant FEE_BASIS_POINTS = 100;
    uint256 public constant Q112 = 2**112;

    address public immutable latte;
    address public immutable pricer;
    address public immutable shopper;
    address public immutable pool;

    address public gov;
    address public cashier;

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

    function getMaxMintableAmount() public view returns (uint256) {
        uint256 supply = ILatte(latte).supplySnapshot();
        uint256 delta = supply.mul(MINTABLE_BASIS_POINTS).div(1000);
        uint256 maxSupply = supply.add(delta);
        uint256 currentSupply = IERC20(latte).totalSupply();
        if (currentSupply >= maxSupply) {
            return 0;
        }
        return maxSupply.sub(currentSupply);
    }

    function getMintableAmount(uint256 value) public view returns (uint256) {
        uint256 lastPrice = uint256(IPricer(pricer).lastPrice());
        if (lastPrice == 0) {
            return 0;
        }
        return value.mul(Q112).div(lastPrice);
    }

    function mint() external payable returns (bool) {
        require(msg.value > 0, "Cafe: insufficient value");
        require(IPricer(pricer).hasIncreasingPrice(), "Cafe: not open for selling");

        uint256 mintable = getMintableAmount(msg.value);
        require(mintable > 0, "Cafe: sell price not available");

        uint256 maxMintable = getMaxMintableAmount();
        require(maxMintable > 0, "Cafe: latte fully sold");

        require(mintable <= maxMintable, "Cafe: amount to sell exceeds allowed limit");

        ILatte(latte).mint(msg.sender, mintable);

        uint256 shopperBasisPoints = (5000 - FEE_BASIS_POINTS) / 2;
        uint256 toShopper = msg.value.mul(shopperBasisPoints).div(10000);
        uint256 toPool = toShopper;
        uint256 toCashier = msg.value.sub(toShopper).sub(toPool);

        address(uint160(shopper)).transfer(toShopper);
        IPool(pool).fund{value: toPool}();
        address(uint160(cashier)).transfer(toCashier);
    }
}
