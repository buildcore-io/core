import { AES, enc } from 'crypto-js';
import * as functions from 'firebase-functions';
import { DEFAULT_NETWORK } from '../../../interfaces/config';
import admin from '../../admin.config';
import { serverTime } from '../../utils/dateTime.utils';

export class MnemonicService {
  public static async store(address: string, mnemonic: string, networtk = DEFAULT_NETWORK): Promise<void> {
    const salt = functions.config()?.encryption?.salt;
    await admin.firestore().collection('_mnemonic').doc(address).set({
      mnemonic: AES.encrypt(mnemonic, salt).toString(),
      networtk,
      createdOn: serverTime()
    });
  }

  public static async get(address: string): Promise<string> {
    const salt = functions.config()?.encryption?.salt;
    const doc = await admin.firestore().collection('_mnemonic').doc(address).get();
    return AES.decrypt(doc.data()?.mnemonic, salt).toString(enc.Utf8);
  }
}
