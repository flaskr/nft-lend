import { assert, expect } from "chai";
import { network, ethers } from "hardhat";
import { TestERC721, ERC721LendWrapper } from "../typechain";

const evmIncreaseSeconds = async (seconds: number) => {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
};

describe("ERC721LendWrapper lends to borrower by minting an ERC-721", async () => {
  const [ lender1, lender2, borrower1, borrower2 ] = await ethers.getSigners();
  let lendWrapper: ERC721LendWrapper;
  let myNft: TestERC721;

  beforeEach(async () => {
    const TestERC721 = await ethers.getContractFactory("TestERC721");
    myNft = (await TestERC721.deploy("fakeURI")) as TestERC721;
    await myNft.deployed();
    const LendWrapper = await ethers.getContractFactory("ERC721LendWrapper");
    lendWrapper = await LendWrapper.deploy(myNft.address, await myNft.name(), await myNft.symbol());
    await lendWrapper.deployed();

    // Mint a token for lender1, and allow lendWrapper to use the nft
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 0);
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 1);
    await myNft.connect(lender2).mint();
    await myNft.connect(lender2).approve(lendWrapper.address, 2);
  });

  it("Should allow an ERC721 owner to lend out a token", async () => {
    expect(await lendWrapper.connect(lender1).lendOut(0, borrower1.address, 1, 1000))
        .to.emit(lendWrapper, "Lent")
        .withArgs(lender1.address, myNft.address, borrower1.address, 0, 1, 1000);

    expect(await myNft.ownerOf(0)).to.equal(lendWrapper.address);
    expect(await lendWrapper.ownerOf(0)).to.equal(borrower1.address);
    expect(await lendWrapper.virtualOwnerOf(0)).to.equal(borrower1.address);
  });

  it ("Should revert if the owner doesn't hold the specified token", async () => {
    expect(await lendWrapper.connect(lender1).lendOut(1, borrower1.address, 1, 1000))
        .to.be.revertedWith("No Bueno");
  });

  it("Should allow a different ERC721 owner to lend out a token previously lent out by a different owner", async () => {
    let timeNow = 1; //TODO: Set Time
    await lendWrapper.connect(lender1).lendOut(0, borrower1.address, timeNow, 1000);

    // Let lending period expire
    evmIncreaseSeconds(2000);

    expect(await lendWrapper.connect(lender1).collect(0))
        .to.emit(lendWrapper, "Collected")
        .withArgs(lender1.address, myNft.address, 0);

    // Let lender2 lend it out
    await myNft.connect(lender1).transferFrom(lender1.address, lender2.address, 0);

    timeNow = 1; //TODO: Set Time
    expect(await lendWrapper.connect(lender2).lendOut(0, borrower2.address, timeNow, 1000))
        .to.emit(lendWrapper, "Lent")
        .withArgs(lender2.address, myNft.address, borrower2.address, 0, 1, 1000);

    expect(await lendWrapper.ownerOf(0)).to.equal(borrower2.address);
  });

  it("Should allow multiple lending at the same time", async () => {
    expect(await lendWrapper.connect(lender1).lendOut(0, borrower1.address, 1, 1000))
        .to.emit(lendWrapper, "Lent")
        .withArgs(lender1.address, myNft.address, borrower1.address, 0, 1, 1000);

    expect(await lendWrapper.connect(lender1).lendOut(1, borrower2.address, 2, 1000))
        .to.emit(lendWrapper, "Lent")
        .withArgs(lender1.address, myNft.address, borrower2.address, 1, 2, 1000);

    expect(await lendWrapper.connect(lender1).lendOut(2, borrower2.address, 3, 1000))
        .to.emit(lendWrapper, "Lent")
        .withArgs(lender1.address, myNft.address, borrower2.address, 2, 3, 1000);


    expect(await lendWrapper.ownerOf(0)).to.equal(borrower1.address);
    expect(await lendWrapper.ownerOf(1)).to.equal(borrower2.address);
    expect(await lendWrapper.ownerOf(2)).to.equal(borrower2.address);
  });
});

describe("ERC721LendWrapper should return correct virtual owner", async () => {
  const [ lender1, lender2, borrower1, borrower2 ] = await ethers.getSigners();
  let lendWrapper: ERC721LendWrapper;
  let myNft: TestERC721;

  beforeEach(async () => {
    const TestERC721 = await ethers.getContractFactory("TestERC721");
    myNft = (await TestERC721.deploy("fakeURI")) as TestERC721;
    await myNft.deployed();
    const LendWrapper = await ethers.getContractFactory("ERC721LendWrapper");
    lendWrapper = await LendWrapper.deploy(myNft.address, await myNft.name(), await myNft.symbol());
    await lendWrapper.deployed();

    // Mint a token for lender1, and allow lendWrapper to use the nft
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 0);
    await lendWrapper.connect(lender1).lendOut(0, borrower1.address, 1, 1000); // valid duration
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 1);
    await lendWrapper.connect(lender1).lendOut(1, borrower1.address, 1, 0); // simulate expiry
    await myNft.connect(lender2).mint();
    await myNft.connect(lender2).approve(lendWrapper.address, 2);
    await lendWrapper.connect(lender2).lendOut(2, borrower2.address, 1, 1000); // valid duration
    await myNft.connect(lender2).mint();
    await myNft.connect(lender2).approve(lendWrapper.address, 3);
    await lendWrapper.connect(lender2).lendOut(3, borrower2.address, 100000, 1000); // simulate pre-lending TODO: Set big start-time
  });

  it("Borrower should have virtual custody of token until the duration expires", async () => {
    expect(await lendWrapper.ownerOf(0)).to.eq(borrower1.address);
    expect(await lendWrapper.virtualOwnerOf(0)).to.eq(borrower1.address);

    // Expiry of lending period
    expect(await lendWrapper.ownerOf(1)).to.eq(borrower1.address); // borrower1 continues to hold on to the wrapper token
    expect(await lendWrapper.virtualOwnerOf(1)).to.eq(lender1.address); // but the virtual owner of the wrapped token should now be reverted to lender

    expect(await lendWrapper.balanceOf(borrower1.address)).to.eq(2);
    expect(await lendWrapper.virtualBalanceOf(borrower1.address)).to.eq(1);


    expect(await lendWrapper.ownerOf(2)).to.eq(borrower2.address);
    expect(await lendWrapper.virtualOwnerOf(2)).to.eq(borrower2.address);

    // Pre-lending period
    expect(await lendWrapper.ownerOf(3)).to.eq(borrower2.address);
    expect(await lendWrapper.virtualOwnerOf(3)).to.eq(lender1.address);

    expect(await lendWrapper.balanceOf(borrower2.address)).to.eq(2);
    expect(await lendWrapper.virtualBalanceOf(borrower2.address)).to.eq(1);
  });

  it("Should allow borrower to transfer the token", async () => {
    await lendWrapper.connect(borrower1).transferFrom(borrower1.address, borrower2.address, 0);

    expect(await lendWrapper.ownerOf(0)).to.eq(borrower2.address);
    expect(await lendWrapper.virtualOwnerOf(0)).to.eq(borrower2.address);
  });

  it("Should allow lender to collect token with expired lending period", async () => {
    expect(await lendWrapper.connect(lender1).collect(1))
        .to.emit(lendWrapper, "Collected")
        .withArgs(lender1.address, 1);

    expect(await myNft.ownerOf(1)).to.equal(lender1.address);
  });

  it("Should not allow lender to collect token if lending period has not expired", async () => {
    expect(await lendWrapper.connect(lender1).collect(0)).to.be.revertedWith('Cannot collect token with active lending duration.');
    expect(await lendWrapper.connect(lender2).collect(2)).to.be.revertedWith('Cannot collect token with active lending duration.');
    expect(await lendWrapper.connect(lender2).collect(3)).to.be.revertedWith('Cannot collect token with active lending duration.');
  });

  [
      {tokenId: 0, lender: lender1, borrower: borrower1, virtualBalanceShouldDecrease: true}, // active lending period
      {tokenId: 1, lender: lender1, borrower: borrower1, virtualBalanceShouldDecrease: false}, // expired lending period
      {tokenId: 3, lender: lender2, borrower: borrower2, virtualBalanceShouldDecrease: false}, // pre-start lending period
  ].forEach( ({tokenId, lender, borrower, virtualBalanceShouldDecrease}) => {
    it("Should allow borrower to surrender the token before duration is over, for tokenId " + tokenId, async () => {
      const initialBalance = (await lendWrapper.balanceOf(borrower.address)).toNumber();
      const initialVirtualBalance = (await lendWrapper.virtualBalanceOf(borrower.address)).toNumber();
      // borrower surrender tokens
      expect(await lendWrapper.connect(borrower).surrender(tokenId))
          .to.emit(lendWrapper, "Surrendered")
          .withArgs(borrower.address, tokenId);

      // Ownership of wrapped tokens is still with borrower, but virtual owner is now back to lender
      expect(await lendWrapper.ownerOf(tokenId)).to.eq(borrower.address);
      expect(await lendWrapper.virtualOwnerOf(tokenId)).to.eq(lender.address);

      // Lenders should be able to collect the surrendered tokens by burning the wrapped tokens
      expect(await lendWrapper.connect(lender).collect(tokenId))
          .to.emit(lendWrapper, "Collected")
          .withArgs(lender.address, tokenId);
      // NFTs should now belong to owners.
      expect(await myNft.ownerOf(tokenId)).to.equal(lender.address);

      // LendWrapper should no longer reflect any owners for token as token has been burnt
      expect(await lendWrapper.ownerOf(tokenId)).to.equal(0); // TODO: Null address
      expect(await lendWrapper.virtualOwnerOf(tokenId)).to.equal(0); // TODO: Null address

      // LendWrapper should decrease the balances accordingly. Virtual balance for tokens with inactive lending periods will remain constant.
      expect(await lendWrapper.balanceOf(borrower.address)).to.equal(initialBalance - 1);
      const expectedVirtualBalance = virtualBalanceShouldDecrease ? initialVirtualBalance - 1 : initialVirtualBalance;
      expect(await lendWrapper.virtualBalanceOf(borrower.address)).to.equal(expectedVirtualBalance);
    })
  });

});

