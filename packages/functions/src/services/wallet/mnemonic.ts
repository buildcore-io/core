import { COL, DEFAULT_NETWORK, Mnemonic } from '@soon/interfaces';
import { AES, enc } from 'crypto-js';
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { serverTime } from '../../utils/dateTime.utils';

export class MnemonicService {
  public static async store(
    address: string,
    mnemonic: string,
    network = DEFAULT_NETWORK,
  ): Promise<void> {
    const salt = functions.config()?.encryption?.salt;
    await admin
      .firestore()
      .collection(COL.MNEMONIC)
      .doc(address)
      .set({
        mnemonic: AES.encrypt(mnemonic, salt).toString(),
        network,
        createdOn: serverTime(),
      });
  }

  public static async get(address: string): Promise<string> {
    const salt = functions.config()?.encryption?.salt;
    const mnemonic = <Mnemonic>(
      (await admin.firestore().collection(COL.MNEMONIC).doc(address).get()).data()
    );
    return AES.decrypt(mnemonic.mnemonic!, salt).toString(enc.Utf8);
  }

  public static async getData(address: string): Promise<Mnemonic> {
    return (
      <Mnemonic>(await admin.firestore().collection(COL.MNEMONIC).doc(address).get()).data() || {}
    );
  }
}
