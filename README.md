# nft-lend

There are different types of NFT lending for different use cases, some mimic real-estate renting, some are backed by collateral.
What this project aims to provide is a building block for non-custodial lending. The borrower is never in full custody of the actual token. Hence, the lender's NFT is safu and the borrower can't run away with it. 
Instead, the token is sent to the contract vault, and the contract provides an interface for services to check who has virtual custody of that token at the current moment. Virtual custody of the token can be traded like any ERC-721 as well.

## Contracts
### ERC721Lender.sol
Primary interface for lending. This tracks a list of addresses and associates them with underlying LendWrappers. It works a little like an ERC-1155, and provides a central lookup to a correct wrapper address for given ERC-721s.
* Allow users to lend out their ERC-721s
* Allow services to look up current 'owner' of NFTs given the ERC-721 address and/or token-id
* Allow users to return their ERC-721s early, before the lending duration is over
* Allow users to collect their ERC-721s

### ERC721LendWrapper.sol
A wrapper around an ERC-721 that is an ERC-721 by itself.
* Each Wrapper is associated with a particular ERC-721 token.
* A Wrapper token can only be minted to a target by depositing the associated ERC-721 token, with a specified lending duration.
  * The token-id will be the same as the wrapped token's token-id.
* The Wrapper token can be transferred from one person to another like a normal ERC-721 token.
* While the wrapper token exists and lending is active, a special `getOwner(tbc)` and `getBalance(tbc)` function will reflect ownership as
  * token borrower, if lending is active
  * token lender, if lending is no longer active
* The token borrower may terminate the lending duration early if they so wish.
* At any time after the lending duration is over, the `collect` or burn method may be called to burn a particular token, and the wrapped token will be returned to the owner.
