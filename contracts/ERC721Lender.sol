//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./ERC721LendWrapper.sol";

contract ERC721Lender is Ownable, IERC721Receiver {
    /// @notice originalTokenAddress => tokenWrapperAddress
    mapping(address => address) public wrappedTokenMapping;

    // ------------------ Events ---------------------- //
    event CreatedNewWrappedToken(address indexed originalTokenAddress, address indexed wrappedTokenAddress);

    event Lent(
        address indexed originalTokenAddress,
        address wrappedTokenAddress,
        uint256 tokenId,
        address indexed lender,
        address indexed borrower,
        uint256 startTime,
        uint256 durationInSeconds
    );

    // ------------------ Modifiers ---------------------- //
    modifier onlyWrappedTokenOwner(address tokenAddress, uint256 tokenId) {
        IERC721 wrappedToken = IERC721(tokenAddress);
        require(_msgSender() == wrappedToken.ownerOf(tokenId), "MsgSender is not owner of wrapped token.");
        _;
    }

    // ------------------ Read Functions ---------------------- //
    /**
        @notice Checks the virtual owner of a given token address and tokenId. Throws if the tokenId is not managed in this contract or if it doesn't exist.
        @dev Reverts in order to retain similar behavior to ERC721.ownerOf()
        @param tokenAddress Address of the wrapped ERC721 token to check
        @param tokenId TokenId to check
        @return Current virtual owner of the token
    */
    function virtualOwnerOf(address tokenAddress, uint256 tokenId) public view returns (address) {
        IERC721 wrappedToken = IERC721(tokenAddress);
        address wrappedTokenAddress = wrappedTokenMapping[tokenAddress];
        if (wrappedToken.ownerOf(tokenId) == wrappedTokenAddress) {
            ERC721LendWrapper lendWrapper = ERC721LendWrapper(wrappedTokenAddress);
            return lendWrapper.virtualOwnerOf(tokenId);
        } else {
            return wrappedToken.ownerOf(tokenId);
        }
    }

    // --------------- Mutative Functions --------------------- //
    /**
        @notice Called by wrapped ERC721 owner to lend out an NFT for a given duration
        @param tokenAddress tokenId of the NFT to be lent out
        @param tokenId tokenId of the NFT to be lent out
        @param borrower address to send the lendWrapper token to
        @param startTime epoch time to start the lending duration
        @param durationInSeconds how long the lending duration will last
    */
    function lendOut(
        address tokenAddress,
        uint256 tokenId,
        address borrower,
        uint256 startTime,
        uint256 durationInSeconds
    ) public onlyWrappedTokenOwner(tokenAddress, tokenId) {
        // Effects
        IERC721 wrappedToken = IERC721(tokenAddress);
        ERC721LendWrapper lendWrapper;
        if (wrappedTokenMapping[tokenAddress] == address(0)) {
            lendWrapper = new ERC721LendWrapper(tokenAddress, "Lend Wrapper", "LNDWRP");
            wrappedTokenMapping[tokenAddress] = address(lendWrapper);
            emit CreatedNewWrappedToken(tokenAddress, address(lendWrapper));
        } else {
            lendWrapper = ERC721LendWrapper(wrappedTokenMapping[tokenAddress]);
        }

        emit Lent(tokenAddress, address(lendWrapper), tokenId, _msgSender(), borrower, startTime, durationInSeconds);

        // Interactions
        wrappedToken.safeTransferFrom(_msgSender(), address(this), tokenId);
        wrappedToken.approve(address(lendWrapper), tokenId);
        lendWrapper.lendOut(tokenId, borrower, startTime, durationInSeconds);
    }

    /**
        @notice Emergency recovery of tokens accidentally sent into this contract. There shouldn't be any user ERC721 in this contract outside of atomic txns at any point of normal operation.
        @param tokenAddress Address of the token to recover
        @param tokenId TokenId of the token to recover
    */
    function recoverERC721(address tokenAddress, uint256 tokenId) public onlyOwner {
        IERC721 tokenToRecover = IERC721(tokenAddress);
        tokenToRecover.transferFrom(address(this), owner(), tokenId);
    }

    /// @dev As a recipient of ERC721.safeTransfer();
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        return IERC721Receiver(operator).onERC721Received.selector;
    }
}
