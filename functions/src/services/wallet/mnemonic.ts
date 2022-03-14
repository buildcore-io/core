import { AES, enc } from 'crypto-js';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export class MnemonicService {
  public static async store(address: string, mnemonic: string): Promise<void> {
    const salt = functions.config()?.encryption?.salt;
    await admin.firestore().collection('_mnemonic').doc(address).set({
      mnemonic: AES.encrypt(mnemonic, salt).toString(),
      createdOn: admin.firestore.Timestamp.now()
    });
  }

  public static async get(address: string): Promise<string> {
    const salt = functions.config()?.encryption?.salt;
    const doc: any = await admin.firestore().collection('_mnemonic').doc(address).get();
    return AES.decrypt(doc!.data().mnemonic, salt).toString(enc.Utf8);
  }
}
