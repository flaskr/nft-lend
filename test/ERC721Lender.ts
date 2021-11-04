import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { ERC721Lender, TestERC721, TestERC721__factory } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { evmIncreaseSeconds, evmNow } from '../lib/utils';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('ERC721Lender should allow lending', function () {
  let TestERC721: TestERC721__factory;
  let nft1: TestERC721;
  let nft2: TestERC721;
  let lenderContract: ERC721Lender;

  let lender1: SignerWithAddress;
  let lender2: SignerWithAddress;
  let lender3: SignerWithAddress;
  let borrower1: SignerWithAddress;
  let borrower2: SignerWithAddress;
  let borrower3: SignerWithAddress;
  let someOtherOwner: SignerWithAddress;

  let startTime: number;

  async function mintAndApprove(token: TestERC721, minter: SignerWithAddress) {
    await token.connect(minter).mint();
    const newTokenId = (await token.totalSupply()).toNumber() - 1;
    await token.connect(minter).approve(lenderContract.address, newTokenId);
  }

  beforeEach(async () => {
    [lender1, lender2, lender3, borrower1, borrower2, borrower3, someOtherOwner] = await ethers.getSigners();
    TestERC721 = await ethers.getContractFactory('TestERC721');
    nft1 = (await TestERC721.deploy('fakeURI1')) as TestERC721;
    nft2 = (await TestERC721.deploy('fakeURI2')) as TestERC721;
    await nft1.deployed();
    await nft2.deployed();
    const Lender = await ethers.getContractFactory('ERC721Lender');
    lenderContract = await Lender.deploy();
    await lenderContract.deployed();

    await mintAndApprove(nft1, lender1); // 0
    await mintAndApprove(nft1, lender1); // 1
    await mintAndApprove(nft1, lender2); // 2
    await mintAndApprove(nft1, lender3); // 3
    await mintAndApprove(nft2, lender1); // 0
    await mintAndApprove(nft2, lender2); // 1
    await mintAndApprove(nft2, lender3); // 2

    startTime = await evmNow();

    // Lend out all the minted tokens to borrowers
    await expect(lenderContract.connect(lender1).lendOut(nft1.address, 0, borrower1.address, startTime, 1000)).to.emit(
      lenderContract,
      'CreatedNewWrappedToken',
    );
    await lenderContract.connect(lender1).lendOut(nft1.address, 1, borrower2.address, startTime, 1000);
    await lenderContract.connect(lender2).lendOut(nft1.address, 2, borrower1.address, startTime, 1000);
    await lenderContract.connect(lender3).lendOut(nft1.address, 3, borrower2.address, startTime, 1000);
    await lenderContract.connect(lender1).lendOut(nft2.address, 0, borrower1.address, startTime, 1000);
    await lenderContract.connect(lender2).lendOut(nft2.address, 1, borrower2.address, startTime, 1000);
    await lenderContract.connect(lender3).lendOut(nft2.address, 2, borrower1.address, startTime, 1000);
  });

  it('Should allow user to check the lendWrapper address, given an ERC721 token.', async () => {
    expect(await lenderContract.wrappedTokenMapping(nft1.address)).to.not.eq(ZERO_ADDRESS);
    expect(await lenderContract.wrappedTokenMapping(nft2.address)).to.not.eq(ZERO_ADDRESS);
    expect(await lenderContract.wrappedTokenMapping(lender1.address)).to.eq(ZERO_ADDRESS); // Invalid wrapped token address should return zero_address
  });

  it('Should emit correct when lending', async () => {
    await nft1.connect(lender3).mint();
    const newTokenId = (await nft1.totalSupply()).toNumber() - 1;
    await nft1.connect(lender3).approve(lenderContract.address, newTokenId);

    const nft1WrapperAddress = await lenderContract.wrappedTokenMapping(nft1.address);

    await expect(lenderContract.connect(lender3).lendOut(nft1.address, newTokenId, borrower2.address, startTime, 2000))
      .to.emit(lenderContract, 'Lent')
      .withArgs(nft1.address, nft1WrapperAddress, newTokenId, lender3.address, borrower2.address, startTime, 2000);
  });

  it('Should allow user to check the virtual owner address, given an ERC721 token address and id.', async () => {
    expect(await lenderContract.virtualOwnerOf(nft1.address, 0)).to.eq(borrower1.address);
    expect(await lenderContract.virtualOwnerOf(nft1.address, 1)).to.eq(borrower2.address);
    expect(await lenderContract.virtualOwnerOf(nft1.address, 2)).to.eq(borrower1.address);
    expect(await lenderContract.virtualOwnerOf(nft1.address, 3)).to.eq(borrower2.address);
    expect(await lenderContract.virtualOwnerOf(nft2.address, 0)).to.eq(borrower1.address);
    expect(await lenderContract.virtualOwnerOf(nft2.address, 1)).to.eq(borrower2.address);
    expect(await lenderContract.virtualOwnerOf(nft2.address, 2)).to.eq(borrower1.address);
  });

  it('Should return owner of nft contracts not registered with contract', async () => {
    const externalNft = (await TestERC721.deploy('fakeURI1')) as TestERC721;
    await externalNft.connect(someOtherOwner).mint();

    expect(await lenderContract.virtualOwnerOf(externalNft.address, 0)).to.eq(someOtherOwner.address);
  });

  it('Should return owner of nft ids not lent out, but registered with contract', async () => {
    await nft1.connect(someOtherOwner).mint();
    const newTokenId = (await nft1.totalSupply()).toNumber() - 1;

    expect(await lenderContract.virtualOwnerOf(nft1.address, newTokenId)).to.eq(someOtherOwner.address);
  });
});
