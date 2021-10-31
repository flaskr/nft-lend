import { expect } from "chai";
import { ethers } from "hardhat";

/*
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


 */

describe("ERC721LendWrapper should allow lending", function () {
  it("Should allow an ERC721 owner to lend out a token", async function () {
    // const Greeter = await ethers.getContractFactory("LendWrapper");
    // const greeter = await Greeter.deploy("Hello, world!");
    // await greeter.deployed();
    //
    // expect(await greeter.greet()).to.equal("Hello, world!");
    //
    // const setGreetingTx = await greeter.setGreeting("Hola, mundo!");
    //
    // // wait until the transaction is mined
    // await setGreetingTx.wait();
    //
    // expect(await greeter.greet()).to.equal("Hola, mundo!");

  });
  it("Should allow an ERC721 owner to lend out a token that was previously lent out before", async function () {

  });
  it("Should allow a different ERC721 owner to lend out a token previously lent out by a different owner", async function () {

  });
});

describe("LendWrapper after lending is active", function () {
  it("Borrower should have virtual custody of token", async function () {
  });
  it("Should allow borrower to transfer the token", async function () {
  });
  it("Should allow borrower to return the token before duration is over", async function() {
  })
});

