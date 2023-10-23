import { SecretManager } from '@iota/sdk';
import { mnemonicToSeedSync } from 'bip39';

export const getSecretManager = (mnemonic: string) => {
  const seed = mnemonicToSeedSync(mnemonic);
  const hexSeed = '0x' + seed.toString('hex');
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return new SecretManager({ hexSeed });
};
