import { COL, DEFAULT_NETWORK, Mnemonic } from '@build-5/interfaces';
import { AES, enc } from 'crypto-js';
import { build5Db } from '../../firebase/firestore/build5Db';
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

  public static async getData(address: string): Promise<Mnemonic> {
    return (await build5Db().collection(COL.MNEMONIC).doc(address).get()) || {};
  }
}
