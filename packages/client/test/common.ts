import { Dataset, Member } from '@build-5/interfaces';
import { CoinType, SecretManager, utf8ToHex } from '@iota/sdk';
import { mnemonicToSeedSync } from 'bip39';
import * as build5 from '../src';
import { AddressDetails, Build5Local, Build5LocalApiKey } from './config';

export const getSignature = async (uid: string, address: AddressDetails) => {
  const member = await build5
    .https(Build5Local)
    .project(Build5LocalApiKey)
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
