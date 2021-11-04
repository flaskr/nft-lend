// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract TestERC721 is ERC721, ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    constructor(string memory customBaseURI_) ERC721("TestToken", "TTKN") {
        customBaseURI = customBaseURI_;
    }

    /** MINTING **/

    uint256 public constant MAX_SUPPLY = 2000;

    Counters.Counter private supplyCounter;

    function mint() public nonReentrant {
        require(totalSupply() < MAX_SUPPLY, "Exceeds max supply");

        _safeMint(_msgSender(), totalSupply());

        supplyCounter.increment();
    }

    function totalSupply() public view returns (uint256) {
        return supplyCounter.current();
    }

    /** ACTIVATION **/

    bool public saleIsActive = false;

    function setSaleIsActive(bool saleIsActive_) external onlyOwner {
        saleIsActive = saleIsActive_;
    }

    /** URI HANDLING **/

    string private customBaseURI;

    function setBaseURI(string memory customBaseURI_) external onlyOwner {
        customBaseURI = customBaseURI_;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return customBaseURI;
    }
}

// Contract created with Studio 721 v1.0.0
// https://721.so
