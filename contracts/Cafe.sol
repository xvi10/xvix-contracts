//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";

import "./interfaces/ILatte.sol";
import "./interfaces/IPricer.sol";

contract Cafe {
    using SafeMath for uint256;

    uint256 public constant MINTABLE_BASIS_POINTS = 20;
    uint256 public constant Q112 = 2**112;

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
        require(msg.sender == gov, "Cafe: forbidden");
        cashier = _cashier;
    }

    function setGov(address _gov) external {
        require(msg.sender == gov, "Cafe: forbidden");
        gov = _gov;
    }

    function getMaxMintableAmount() public view returns (uint256) {
        uint256 supply = ILatte(latte).supplySnapshot();
        uint256 maxSupply = supply.mul(MINTABLE_BASIS_POINTS).div(1000);
        uint256 currentSupply = ILatte(latte).totalSupply();
        if (currentSupply > maxSupply) {
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
        require(IPricer(pricer).hasIncreasingPrice(), "Cafe: not open for minting");

        uint256 mintable = getMintableAmount(msg.value);
        require(mintable > 0, "Cafe: mint price not available");

        uint256 maxMintable = getMaxMintableAmount();
        require(maxMintable > 0, "Cafe: latte fully sold");

        require(mintable <= maxMintable, "Cafe: insufficient latte to fulfill request");

        ILatte(latte).mint(msg.sender, mintable);

        uint256 toShopper = msg.value.mul(4995).div(10000);
        uint256 toReserve = toShopper;
        uint256 toCashier = msg.value.sub(toShopper).sub(toReserve);

        address(uint160(shopper)).transfer(toShopper);
        address(uint160(reserve)).transfer(toReserve);
        address(uint160(cashier)).transfer(toCashier);
    }
}
