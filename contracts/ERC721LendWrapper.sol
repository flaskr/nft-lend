//SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract ERC721LendWrapper is ERC721, ERC721Burnable, IERC721Receiver { //Add ERC721 receiver interface

    IERC721 public wrappedToken;
    mapping(uint256 => LendingDuration) public lendingDurations;

    constructor(address _wrappedTokenAddress, string memory _tokenName, string memory _tokenSymbol) ERC721(_tokenName, _tokenSymbol) {
        wrappedToken = IERC721(_wrappedTokenAddress);
    }

    struct LendingDuration {
        uint256 startTime;
        uint256 endTime;
    }

    event Lent(uint256 indexed tokenId, address indexed owner, address indexed borrower, uint256 startTime, uint256 endTime);
    event Collected(uint256 indexed tokenId, address indexed owner);


    modifier lendIsActive(uint256 _tokenId) {
        require(isLendActive(_tokenId), "Lend is not active");
        _;
    }

    modifier onlyWrappedTokenOwner(uint256 _tokenId) { // needs rework. the owner is going to be this contract lol
        require(_msgSender() == wrappedToken.ownerOf(_tokenId), "MsgSender is not owner of wrapped token.");
        _;
    }

    function isLendActive(uint256 _tokenId) public view returns (bool) {
        LendingDuration memory foundDuration = lendingDurations[_tokenId];
        return (foundDuration.startTime != 0 && (foundDuration.startTime <= block.timestamp && block.timestamp <= foundDuration.endTime));
    }

    function virtualOwnerOf(uint256 _tokenId) public view returns(address) {
        return address(0);
    }

    function virtualBalanceOf(address _addressToCheck) public view returns(uint256) {
        return 0;
    }

    function lendOut(uint256 _tokenId, address _borrower, uint256 startTime, uint256 durationInSeconds)
    public
    onlyWrappedTokenOwner(_tokenId) {
        lendingDurations[_tokenId] = LendingDuration(startTime, startTime + durationInSeconds);
        _safeMint(_borrower, _tokenId);
        wrappedToken.safeTransferFrom(_msgSender(), address(this), _tokenId);
        emit Lent(_tokenId, _msgSender(), _borrower, startTime, durationInSeconds);
    }

    function collect(uint256 _tokenId) public onlyWrappedTokenOwner(_tokenId) {
        delete lendingDurations[_tokenId];
        _burn(_tokenId);
        emit Collected(_tokenId, _msgSender());
        wrappedToken.safeTransferFrom(address(this), _msgSender(), _tokenId);
    }

    /// @notice Surrender the borrowed token back to the lender.
    function surrender(uint256 _tokenId) public {

    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        //verify that only the corrrect erc721 was received, if not revert.
        return IERC721Receiver(operator).onERC721Received.selector;
    }
}
