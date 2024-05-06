import { Dataset, Member } from '@buildcore/interfaces';
import { CoinType, SecretManager, utf8ToHex } from '@iota/sdk';
import * as buildcore from '../../src';
import { AddressDetails, BuildcoreLocalApi, BuildcoreLocalApiKey } from '../config';

export const walletSign = async (uid: string, address: AddressDetails) => {
  const member = await buildcore
    .https(BuildcoreLocalApi)
    .project(BuildcoreLocalApiKey)
    .dataset(Dataset.MEMBER)
    .id(uid)
    .get();
  const secretManager = new SecretManager({ mnemonic: address.mnemonic });
  const signature = await secretManager.signEd25519(utf8ToHex((member as Member).nonce!), {
    coinType: CoinType.IOTA,
  });
  return signature;
};

// Runs a function several times until the it gets the desired output
export const wait = async (
  func: () => Promise<boolean | undefined>,
  maxAttempt = 1200,
  delay = 500,
) => {
  for (let attempt = 0; attempt < maxAttempt; ++attempt) {
    if (await func()) {
      return;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Timeout');
};
