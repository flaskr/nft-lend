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

    struct LendingDuration {
        uint256 startTime;
        uint256 endTime;
    }

    constructor(
        address _wrappedTokenAddress,
        string memory _tokenName,
        string memory _tokenSymbol
    ) ERC721(_tokenName, _tokenSymbol) {
        wrappedToken = IERC721(_wrappedTokenAddress);
    }

    // ------------------ Events ---------------------- //
    event Lent(
        uint256 indexed tokenId,
        address indexed lender,
        address indexed borrower,
        uint256 startTime,
        uint256 durationInSeconds
    );

    event Collected(uint256 indexed tokenId, address indexed lender);

    // ------------------ Modifiers ---------------------- //
    modifier onlyWrappedTokenOwner(uint256 tokenId) {
        require(_msgSender() == wrappedToken.ownerOf(tokenId), "MsgSender is not owner of wrapped token.");
        _;
    }

    // ------------------ Read Functions ---------------------- //

    /**
        @notice Returns true if the lend is active for given tokenId. Most users will be relying on `virtualOwnerOf()` to check for owner of a tokenId.
        @param tokenId TokenId to check
        @return true if token's lend duration is still active.
    */
    function isLendActive(uint256 tokenId) public view returns (bool) {
        LendingDuration memory foundDuration = lendingDurations[tokenId];
        return (foundDuration.startTime != 0 &&
            (foundDuration.startTime <= block.timestamp && block.timestamp <= foundDuration.endTime));
    }

    /**
        @notice Returns true if the lend is past the endTime. You should use `isLendActive()` to check for lend validity, unless you know what you're doing.
        @dev The check is invalid if startTIme is 0, since the duration is not found. This is a valid assumption since they can't be created as 0 due to `lendOut()`.
    */
    function isLendExpired(uint256 tokenId) public view returns (bool) {
        LendingDuration memory foundDuration = lendingDurations[tokenId];
        return foundDuration.startTime != 0 && foundDuration.endTime < block.timestamp;
    }

    /**
        @notice Checks the virtual owner of a given tokenId. Throws if the tokenId is not managed in this contract or if it doesn't exist.
        @dev Reverts in order to retain similar behavior to ERC721.ownerOf()
        @param tokenId TokenId to check
        @return Owner of the token
    */
    function virtualOwnerOf(uint256 tokenId) public view returns (address) {
        if (isLendActive(tokenId)) {
            return ownerOf(tokenId);
        } else {
            if (wrappedTokenLenders[tokenId] != address(0)) {
                // token is in this contract
                return wrappedTokenLenders[tokenId];
            } else {
                //token is not in this contract
                return wrappedToken.ownerOf(tokenId);
            }
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
        lendingDurations[tokenId] = LendingDuration(startTime, startTime + durationInSeconds);
        wrappedTokenLenders[tokenId] = _msgSender();
        _safeMint(borrower, tokenId);
        emit Lent(tokenId, _msgSender(), borrower, startTime, durationInSeconds);
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
        @notice Call to withdraw the wrapped NFT to original lender, by burning this token. This is valid only after a lend period is completed.
        @param tokenId tokenId of the NFT to be sent to original lender
    */
    function collect(uint256 tokenId) public {
        require(isLendExpired(tokenId), "Lend has not expired");
        _returnWrappedTokenToLender(tokenId);
    }

    /**
        @notice Surrender the borrowed token to the lender by burning this token
        @param tokenId tokenId of the NFT to surrender
     */
    function surrender(uint256 tokenId) public {
        require(_msgSender() == ownerOf(tokenId), "msgSender() is not the owner of token id");
        _returnWrappedTokenToLender(tokenId);
    }

    /// @dev As a recipient of ERC721.safeTransfer();
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        require(msg.sender == address(wrappedToken), "Can only receive wrapped ERC721");
        return IERC721Receiver(operator).onERC721Received.selector;
    }
}
