import { ethers } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();

    const TestERC721 = await ethers.getContractFactory('TestERC721');
    const nftToken = await TestERC721.deploy('');
    await nftToken.deployed();

    console.log('NFT deployed to:', nftToken.address);

    nftToken.connect(deployer).mint();
    nftToken.connect(deployer).mint();
    nftToken.connect(deployer).mint();
    console.log('minted 3 NFTs to :', deployer.address);

    const Lender = await ethers.getContractFactory('ERC721Lender');
    const lender = await Lender.deploy();
    await lender.deployed();

    console.log('Lender deployed to:', lender.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
