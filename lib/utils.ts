import { ethers, network } from 'hardhat';

export const evmIncreaseSeconds = async (seconds: number): Promise<void> => {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
};

export const evmNow = async (): Promise<number> => {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  return blockBefore.timestamp;
};
