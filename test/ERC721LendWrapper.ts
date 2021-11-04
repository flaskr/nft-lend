import { expect } from 'chai';
import { network, ethers } from 'hardhat';
import { TestERC721, ERC721LendWrapper, TestERC721__factory, ERC721LendWrapper__factory } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { evmIncreaseSeconds, evmNow } from '../lib/utils';

describe('ERC721LendWrapper lends to borrower by minting an ERC-721', function () {
  let TestERC721: TestERC721__factory;
  let myNft: TestERC721;
  let LendWrapper: ERC721LendWrapper__factory;
  let lendWrapper: ERC721LendWrapper;

  let lender1: SignerWithAddress;
  let lender2: SignerWithAddress;
  let borrower1: SignerWithAddress;
  let borrower2: SignerWithAddress;

  let startTime: number;

  beforeEach(async () => {
    [lender1, lender2, borrower1, borrower2] = await ethers.getSigners();
    TestERC721 = await ethers.getContractFactory('TestERC721');
    myNft = (await TestERC721.deploy('fakeURI')) as TestERC721;
    await myNft.deployed();
    LendWrapper = await ethers.getContractFactory('ERC721LendWrapper');
    lendWrapper = await LendWrapper.deploy(myNft.address, await myNft.name(), await myNft.symbol());
    await lendWrapper.deployed();

    // Mint a token for lender1, and allow lendWrapper to use the nft
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 0);
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 1);
    await myNft.connect(lender2).mint();
    await myNft.connect(lender2).approve(lendWrapper.address, 2);
    startTime = await evmNow();
  });

  it('Should allow an ERC721 owner to lend out a token', async () => {
    await expect(await lendWrapper.connect(lender1).lendOut(0, borrower1.address, startTime, 1000))
      .to.emit(lendWrapper, 'Lent')
      .withArgs(0, lender1.address, borrower1.address, startTime, 1000);

    expect(await myNft.ownerOf(0)).to.equal(lendWrapper.address);
    expect(await lendWrapper.ownerOf(0)).to.equal(borrower1.address);
    expect(await lendWrapper.virtualOwnerOf(0)).to.equal(borrower1.address);
  });

  it('Should not allow an ERC721 owner to lend out a token to an invalid address', async () => {
    await expect(await lendWrapper.connect(lender1).lendOut(0, borrower1.address, startTime, 1000))
      .to.emit(lendWrapper, 'Lent')
      .withArgs(0, lender1.address, borrower1.address, startTime, 1000);

    expect(await myNft.ownerOf(0)).to.equal(lendWrapper.address);
    expect(await lendWrapper.ownerOf(0)).to.equal(borrower1.address);
    expect(await lendWrapper.virtualOwnerOf(0)).to.equal(borrower1.address);
  });

  it("Should revert if the owner doesn't hold the specified token", async () => {
    await expect(lendWrapper.connect(lender1).lendOut(2, borrower1.address, startTime, 1000)).to.be.revertedWith(
      'MsgSender is not owner of wrapped token.',
    );
  });

  it('Should allow a different ERC721 owner to lend out a token previously lent out by a different owner', async () => {
    let timeNow = await evmNow();
    await lendWrapper.connect(lender1).lendOut(0, borrower1.address, timeNow, 1000);

    // Let lending period expire
    evmIncreaseSeconds(2000);

    expect(await lendWrapper.connect(lender1).collect(0))
      .to.emit(lendWrapper, 'Collected')
      .withArgs(0, lender1.address);

    expect(await myNft.ownerOf(0)).to.be.equal(lender1.address);

    // Let lender2 lend it out
    await myNft.connect(lender1).transferFrom(lender1.address, lender2.address, 0);

    timeNow = await evmNow();
    await myNft.connect(lender2).approve(lendWrapper.address, 0);
    expect(await lendWrapper.connect(lender2).lendOut(0, borrower2.address, timeNow, 1000))
      .to.emit(lendWrapper, 'Lent')
      .withArgs(0, lender2.address, borrower2.address, timeNow, 1000);

    expect(await lendWrapper.ownerOf(0)).to.equal(borrower2.address);
  });

  it('Should allow multiple lending at the same time', async () => {
    expect(await lendWrapper.connect(lender1).lendOut(0, borrower1.address, startTime, 1000))
      .to.emit(lendWrapper, 'Lent')
      .withArgs(0, lender1.address, borrower1.address, startTime, 1000);

    startTime = await evmNow();
    expect(await lendWrapper.connect(lender1).lendOut(1, borrower2.address, startTime, 1000))
      .to.emit(lendWrapper, 'Lent')
      .withArgs(1, lender1.address, borrower2.address, startTime, 1000);

    startTime = await evmNow();
    expect(await lendWrapper.connect(lender2).lendOut(2, borrower2.address, startTime, 1000))
      .to.emit(lendWrapper, 'Lent')
      .withArgs(2, lender2.address, borrower2.address, startTime, 1000);

    expect(await lendWrapper.ownerOf(0)).to.equal(borrower1.address);
    expect(await lendWrapper.ownerOf(1)).to.equal(borrower2.address);
    expect(await lendWrapper.ownerOf(2)).to.equal(borrower2.address);
  });
});

describe('ERC721LendWrapper should return correct virtual owner', function () {
  let TestERC721: TestERC721__factory;
  let myNft: TestERC721;
  let LendWrapper: ERC721LendWrapper__factory;
  let lendWrapper: ERC721LendWrapper;

  let lender1: SignerWithAddress;
  let lender2: SignerWithAddress;
  let borrower1: SignerWithAddress;
  let borrower2: SignerWithAddress;

  let startTime: number;

  beforeEach(async () => {
    [lender1, lender2, borrower1, borrower2] = await ethers.getSigners();
    TestERC721 = await ethers.getContractFactory('TestERC721');
    myNft = (await TestERC721.deploy('fakeURI')) as TestERC721;
    await myNft.deployed();
    LendWrapper = await ethers.getContractFactory('ERC721LendWrapper');
    lendWrapper = await LendWrapper.deploy(myNft.address, await myNft.name(), await myNft.symbol());
    await lendWrapper.deployed();

    startTime = await evmNow();
    await evmIncreaseSeconds(1);
    // Mint a token for lender1, and allow lendWrapper to use the nft
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 0);
    await lendWrapper.connect(lender1).lendOut(0, borrower1.address, startTime, 1000); // valid duration
    await myNft.connect(lender1).mint();
    await myNft.connect(lender1).approve(lendWrapper.address, 1);
    await lendWrapper.connect(lender1).lendOut(1, borrower1.address, startTime, 0); // simulate expiry
    await myNft.connect(lender2).mint();
    await myNft.connect(lender2).approve(lendWrapper.address, 2);
    await lendWrapper.connect(lender2).lendOut(2, borrower2.address, startTime, 1000); // valid duration
    await myNft.connect(lender2).mint();
    await myNft.connect(lender2).approve(lendWrapper.address, 3);
    await lendWrapper.connect(lender2).lendOut(3, borrower2.address, startTime + 10000, 1000); // simulate pre-lending
  });

  it('Borrower should have virtual custody of token until the duration expires', async () => {
    expect(await lendWrapper.ownerOf(0)).to.eq(borrower1.address);
    expect(await lendWrapper.virtualOwnerOf(0)).to.eq(borrower1.address);

    // Expiry of lending period
    expect(await lendWrapper.ownerOf(1)).to.eq(borrower1.address); // borrower1 continues to hold on to the wrapper token
    expect(await lendWrapper.virtualOwnerOf(1)).to.eq(lender1.address); // but the virtual owner of the wrapped token should now be reverted to lender

    expect(await lendWrapper.balanceOf(borrower1.address)).to.eq(2);

    expect(await lendWrapper.ownerOf(2)).to.eq(borrower2.address);
    expect(await lendWrapper.virtualOwnerOf(2)).to.eq(borrower2.address);

    // Pre-lending period
    expect(await lendWrapper.ownerOf(3)).to.eq(borrower2.address);
    expect(await lendWrapper.virtualOwnerOf(3)).to.eq(lender2.address);

    expect(await lendWrapper.balanceOf(borrower2.address)).to.eq(2);
  });

  it('Should allow borrower to transfer the token', async () => {
    await lendWrapper.connect(borrower1).transferFrom(borrower1.address, borrower2.address, 0);

    expect(await lendWrapper.ownerOf(0)).to.eq(borrower2.address);
    expect(await lendWrapper.virtualOwnerOf(0)).to.eq(borrower2.address);
  });

  it('Should allow lender to collect token with expired lending period', async () => {
    expect(await lendWrapper.connect(lender1).collect(1))
      .to.emit(lendWrapper, 'Collected')
      .withArgs(1, lender1.address);

    expect(await myNft.ownerOf(1)).to.equal(lender1.address);
  });

  it('Should not allow lender to collect token if lending period has not expired', async () => {
    await expect(lendWrapper.connect(lender1).collect(0)).to.be.revertedWith('Lend has not expired');
    await expect(lendWrapper.connect(lender2).collect(2)).to.be.revertedWith('Lend has not expired');
    await expect(lendWrapper.connect(lender2).collect(3)).to.be.revertedWith('Lend has not expired');
  });

  async function assertBorrowerCanSurrender(tokenId: number, lender: SignerWithAddress, borrower: SignerWithAddress) {
    const initialBalance = (await lendWrapper.balanceOf(borrower.address)).toNumber();
    // borrower surrender tokens
    expect(await lendWrapper.connect(borrower).surrender(tokenId))
      .to.emit(lendWrapper, 'Collected')
      .withArgs(tokenId, lender.address);

    // NFTs should now belong to owners.
    expect(await myNft.ownerOf(tokenId)).to.equal(lender.address);

    // LendWrapper should no longer reflect any owners for token as token has been burnt
    await expect(lendWrapper.ownerOf(tokenId)).to.be.revertedWith('ERC721: owner query for nonexistent token');
    expect(await lendWrapper.virtualOwnerOf(tokenId)).to.equal(lender.address);

    // LendWrapper should decrease the balances accordingly. Virtual balance for tokens with inactive lending periods will remain constant.
    expect(await lendWrapper.balanceOf(borrower.address)).to.equal(initialBalance - 1);
  }

  it('Should allow borrower to surrender the token to allow collection during active lending period', async () => {
    await assertBorrowerCanSurrender(0, lender1, borrower1);
  });

  it('Should allow borrower to surrender the token to allow collection after expired lending period', async () => {
    await assertBorrowerCanSurrender(1, lender1, borrower1);
  });

  it('Should allow borrower to surrender the token to allow collection before lending is active', async () => {
    await assertBorrowerCanSurrender(3, lender2, borrower2);
  });
});
