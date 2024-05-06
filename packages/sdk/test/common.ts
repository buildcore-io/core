import { Dataset, Member } from '@buildcore/interfaces';
import { CoinType, SecretManager, utf8ToHex } from '@iota/sdk';
import { mnemonicToSeedSync } from 'bip39';
import * as buildcore from '../src';
import { AddressDetails, BuildcoreLocal, BuildcoreLocalApiKey } from './config';

export const getSignature = async (uid: string, address: AddressDetails) => {
  const member = await buildcore
    .https(BuildcoreLocal)
    .project(BuildcoreLocalApiKey)
    .dataset(Dataset.MEMBER)
    .id(uid)
    .get();

  const seed = mnemonicToSeedSync(address.mnemonic);
  const hexSeed = '0x' + seed.toString('hex');
  const secretManager = new SecretManager({ hexSeed });
  const signature = await secretManager.signEd25519(utf8ToHex((member as Member).nonce!), {
    coinType: CoinType.IOTA,
  });
  return signature;
};
