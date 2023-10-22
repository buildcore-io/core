import { build5Db } from '@build-5/database';
import { COL, DEFAULT_NETWORK, Mnemonic } from '@build-5/interfaces';
import { AES, enc } from 'crypto-js';
export class MnemonicService {
  public static async store(
    address: string,
    mnemonic: string,
    network = DEFAULT_NETWORK,
  ): Promise<void> {
    await build5Db()
      .collection(COL.MNEMONIC)
      .doc(address)
      .set({
        mnemonic: AES.encrypt(mnemonic, process.env.ENCRYPTION_SALT || '').toString(),
        network,
      });
  }

  public static async get(address: string): Promise<string> {
    const mnemonic = <Mnemonic>await build5Db().collection(COL.MNEMONIC).doc(address).get();
    return AES.decrypt(mnemonic.mnemonic!, process.env.ENCRYPTION_SALT || '').toString(enc.Utf8);
  }

  public static async getData(address: string | undefined): Promise<Mnemonic> {
    if (!address) {
      return {};
    }
    return (await build5Db().collection(COL.MNEMONIC).doc(address).get()) || {};
  }
}
