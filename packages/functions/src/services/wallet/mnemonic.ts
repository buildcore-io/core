import { COL, DEFAULT_NETWORK, Mnemonic } from '@soonaverse/interfaces';
import { AES, enc } from 'crypto-js';
import * as functions from 'firebase-functions';
import { soonDb } from '../../firebase/firestore/soondb';

export class MnemonicService {
  public static async store(
    address: string,
    mnemonic: string,
    network = DEFAULT_NETWORK,
  ): Promise<void> {
    const salt = functions.config()?.encryption?.salt;
    await soonDb()
      .collection(COL.MNEMONIC)
      .doc(address)
      .set({
        mnemonic: AES.encrypt(mnemonic, salt).toString(),
        network,
      });
  }

  public static async get(address: string): Promise<string> {
    const salt = functions.config()?.encryption?.salt;
    const mnemonic = <Mnemonic>await soonDb().collection(COL.MNEMONIC).doc(address).get();
    return AES.decrypt(mnemonic.mnemonic!, salt).toString(enc.Utf8);
  }

  public static async getData(address: string): Promise<Mnemonic> {
    return (await soonDb().collection(COL.MNEMONIC).doc(address).get()) || {};
  }
}
