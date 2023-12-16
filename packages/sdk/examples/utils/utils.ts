import { Dataset, Member } from '@build-5/interfaces';
import { API_KEY, Build5, https } from '@build-5/sdk';
import { CoinType, SecretManager, utf8ToHex } from '@iota/sdk';
import { mnemonicToSeedSync } from 'bip39';
import { AddressDetails } from './secret';

/**
 * Here we are signing via code. This signing can OF COURSE be replaced through wallets such TanglePay / Metamask.
 *
 * @param uid
 * @param address
 * @returns
 */
export const walletSign = async (uid: string, address: AddressDetails) => {
  const member = await https(Build5.TEST).project(API_KEY[Build5.TEST]).dataset(Dataset.MEMBER).id(uid).get();
  const seed = mnemonicToSeedSync(address.mnemonic);
  const hexSeed = '0x' + seed.toString('hex');
  const secretManager = new SecretManager({ hexSeed });
  const signature = await secretManager.signEd25519(utf8ToHex((member as Member).nonce!), {
    coinType: CoinType.IOTA,
  });
  return signature;
};
