import { build5Db } from '@build-5/database';
import { COL, DEFAULT_NETWORK, Mnemonic, Network, NetworkAddress } from '@build-5/interfaces';
import { AES, enc } from 'crypto-js';

export class MnemonicService {
  public static async store(
    address: NetworkAddress,
    mnemonic: string,
    network = DEFAULT_NETWORK,
  ): Promise<void> {
    await build5Db()
      .collection(COL.MNEMONIC)
      .doc(address)
      .upsert({
        mnemonic: AES.encrypt(mnemonic, process.env.ENCRYPTION_SALT || '').toString(),
        network: network as Network,
        consumedOutputIds: [],
        consumedNftOutputIds: [],
        consumedAliasOutputIds: [],
      });
  }

  public static async get(address: NetworkAddress): Promise<string> {
    const mnemonic = <Mnemonic>await build5Db().collection(COL.MNEMONIC).doc(address).get();
    return AES.decrypt(mnemonic.mnemonic!, process.env.ENCRYPTION_SALT || '').toString(enc.Utf8);
  }

  public static async getData(address: NetworkAddress | undefined): Promise<Mnemonic> {
    if (!address) {
      return {} as Mnemonic;
    }
    const docRef = build5Db().doc(COL.MNEMONIC, address);
    return (await docRef.get()) || ({} as Mnemonic);
  }
}
