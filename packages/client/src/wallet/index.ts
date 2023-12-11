import { getClient } from './client';
import { Wallet } from './wallet';

export const createWallet = async (mnemonic: string, otrAddress: string, customNodeUrl = '') => {
  const { client, info } = await getClient(otrAddress, customNodeUrl);
  return new Wallet(mnemonic, client, info);
};
