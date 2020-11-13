//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libraries/math/SafeMath.sol";
import "./libraries/token/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "./interfaces/IMinter.sol";
import "./interfaces/IXVIX.sol";
import "./interfaces/IFloor.sol";


contract Minter is IMinter, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant REDUCTION_BASIS_POINTS = 1000; // 10%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    address public immutable xvix;
    address public immutable floor;

    uint256 public ethReserve;

    event Mint(address indexed to, uint256 value);

    constructor(address _xvix, address _floor, uint256 _ethReserve) public {
        xvix = _xvix;
        floor = _floor;
        ethReserve = _ethReserve;
    }

    function mint(address _receiver) external payable nonReentrant {
        require(msg.value > 0, "Minter: insufficient value");

        uint256 toMint = getMintAmount(msg.value);
        require(toMint > 0, "Minter: mint amount is zero");

        IXVIX(xvix).mint(_receiver, toMint);
        ethReserve = ethReserve.add(msg.value);

        (bool success,) = floor.call{value: msg.value}("");
        require(success, "Minter: transfer to floor failed");

        emit Mint(_receiver, toMint);
    }

    function getMintAmount(uint256 _ethAmount) public view returns (uint256) {
        if (IFloor(floor).capital() == 0) {
            return 0;
        }

        uint256 k = ethReserve.mul(tokenReserve());
        uint256 a = k.div(ethReserve.add(_ethAmount));
        uint256 mintable = tokenReserve().sub(a);

        // the maximum tokens that can be minted is capped by the price floor of the floor
        // this ensures that minting tokens will never reduce the price floor
        // the maximum tokens is also further reduced so that the price floor will increase
        uint256 floorMax = IFloor(floor).getMintAmount(_ethAmount);
        uint256 reduction = floorMax.mul(REDUCTION_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        uint256 max = floorMax.sub(reduction);

        return mintable < max ? mintable : max;
    }

    function tokenReserve() public view returns (uint256) {
        uint256 maxSupply = IXVIX(xvix).maxSupply();
        uint256 totalSupply = IERC20(xvix).totalSupply();
        return maxSupply.sub(totalSupply);
    }
}
