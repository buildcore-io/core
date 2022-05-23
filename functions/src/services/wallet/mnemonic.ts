import { AES, enc } from 'crypto-js';
import * as functions from 'firebase-functions';
import { serverTime } from '../../utils/dateTime.utils';
import admin from '../../admin.config';

export class MnemonicService {
  public static async store(address: string, mnemonic: string): Promise<void> {
    const salt = functions.config()?.encryption?.salt;
    await admin.firestore().collection('_mnemonic').doc(address).set({
      mnemonic: AES.encrypt(mnemonic, salt).toString(),
      createdOn: serverTime()
    });
  }

  public static async get(address: string): Promise<string> {
    const salt = functions.config()?.encryption?.salt;
    const doc = await admin.firestore().collection('_mnemonic').doc(address).get();
    return AES.decrypt(doc.data()?.mnemonic, salt).toString(enc.Utf8);
  }
}
