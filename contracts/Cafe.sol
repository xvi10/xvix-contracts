//SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "./libraries/math/SafeMath.sol";
import "./Latte.sol";
import "./interfaces/IPricer.sol";

contract Cafe {
    using SafeMath for uint256;
    address public latte;
    address public pricer;
    address public gov;
    address public feeTo;

    constructor(address _latte, address _pricer) public {
        latte = _latte;
        pricer = _pricer;
        gov = msg.sender;
        feeTo = msg.sender;
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == gov, "Cafe: forbidden");
        feeTo = _feeTo;
    }

    function setGov(address _gov) external {
        require(msg.sender == gov, "Cafe: forbidden");
        gov = _gov;
    }

    function mint() external payable {
        require(msg.value > 0, "Cafe: insufficient value");
        // calculate the max mintable amount
        // get the amount of ethereum to charge and amount to be minted
        // mint the amount to the user and refund the remaining eth to the user
        // send the received eth to LatteReserve, LatteBuyer and feeTo
    }
}
