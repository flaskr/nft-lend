//SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "hardhat/console.sol";

contract ERC721LendWrapper is
    ERC721,
    ERC721Burnable,
    IERC721Receiver //Add ERC721 receiver interface
{
    IERC721 public wrappedToken;
    mapping(uint256 => LendingDuration) public lendingDurations;
    mapping(uint256 => address) public wrappedTokenLenders;

    constructor(
        address _wrappedTokenAddress,
        string memory _tokenName,
        string memory _tokenSymbol
    ) ERC721(_tokenName, _tokenSymbol) {
        wrappedToken = IERC721(_wrappedTokenAddress);
    }

    struct LendingDuration {
        uint256 startTime;
        uint256 endTime;
    }

    event Lent(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed borrower,
        uint256 startTime,
        uint256 durationInSeconds
    );
    event Collected(uint256 indexed tokenId, address indexed lender);

    modifier lendIsActive(uint256 _tokenId) {
        require(isLendActive(_tokenId), "Lend is not active");
        _;
    }

    modifier onlyWrappedTokenOwner(uint256 _tokenId) {
        // needs rework. the owner is going to be this contract lol
        require(
            _msgSender() == wrappedToken.ownerOf(_tokenId),
            "MsgSender is not owner of wrapped token."
        );
        _;
    }

    // ------------------ Read Functions ---------------------- //

    function isLendActive(uint256 tokenId) public view returns (bool) {
        LendingDuration memory foundDuration = lendingDurations[tokenId];
        return (foundDuration.startTime != 0 &&
            (foundDuration.startTime <= block.timestamp &&
                block.timestamp <= foundDuration.endTime));
    }

    function isLendInPreStart(uint256 tokenId) public view returns (bool) {
        LendingDuration memory foundDuration = lendingDurations[tokenId];
        return block.timestamp < foundDuration.startTime;
    }

    function virtualOwnerOf(uint256 tokenId) public view returns (address) {
        if (isLendActive(tokenId)) {
            return ownerOf(tokenId);
        } else {
            require(
                wrappedTokenLenders[tokenId] != address(0),
                "owner query for nonexistent token"
            );
            return wrappedTokenLenders[tokenId];
        }
    }

    // --------------- Mutative Functions --------------------- //
    /**
        @notice Called by wrapped ERC721 owner to lend out an NFT for a given duration
        @param tokenId tokenId of the NFT to be lent out
        @param borrower address to send the lendWrapper token to
        @param startTime epoch time to start the lending duration
        @param durationInSeconds how long the lending duration will last
    */
    function lendOut(
        uint256 tokenId,
        address borrower,
        uint256 startTime,
        uint256 durationInSeconds
    ) public onlyWrappedTokenOwner(tokenId) {
        require(startTime > 0, "StartTime cannot be 0"); // 0 startTime will be used to check if a lendingDuration exists. Also, this is likely a mis-input
        require(borrower != address(0), "Cannot lend to invalid address"); // in case invalid address was provided by another smart contract.
        lendingDurations[tokenId] = LendingDuration(
            startTime,
            startTime + durationInSeconds
        );
        wrappedTokenLenders[tokenId] = _msgSender();
        _safeMint(borrower, tokenId);
        emit Lent(
            tokenId,
            _msgSender(),
            borrower,
            startTime,
            durationInSeconds
        );
        wrappedToken.safeTransferFrom(_msgSender(), address(this), tokenId);
    }

    /**
        @dev Returns the wrapped token to original lender without further checks.
        @param tokenId tokenId of the NFT to be sent to original lender
    */
    function _returnWrappedTokenToLender(uint256 tokenId) private {
        delete lendingDurations[tokenId];
        address originalLender = wrappedTokenLenders[tokenId];
        delete wrappedTokenLenders[tokenId];
        _burn(tokenId);
        emit Collected(tokenId, originalLender);
        wrappedToken.safeTransferFrom(address(this), originalLender, tokenId);
    }

    /**
        @notice Call to withdraw the wrapped NFT to original lender, by burning this token
        @param tokenId tokenId of the NFT to be sent to original lender
    */
    function collect(uint256 tokenId) public {
        require(!isLendActive(tokenId), "Lend is still active");
        require(!isLendInPreStart(tokenId), "Pending start of lend period");
        _returnWrappedTokenToLender(tokenId);
    }

    /**
        @notice Surrender the borrowed token to the lender by burning this token
        @param tokenId tokenId of the NFT to surrender
     */
    function surrender(uint256 tokenId) public {
        require(
            _msgSender() == ownerOf(tokenId),
            "msgSender() is not the owner of token id"
        );
        _returnWrappedTokenToLender(tokenId);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        require(
            msg.sender == address(wrappedToken),
            "Can only receive wrapped ERC721"
        );
        return IERC721Receiver(operator).onERC721Received.selector;
    }
}
