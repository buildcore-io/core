import { AES } from 'crypto-js';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const defaultSalt = 'sa#asda!2sasd##asad';
export class MnemonicService {
  public static async store(address: string, mnemonic: string): Promise<void> {
    const salt = functions.config().encryption.salt || defaultSalt;
    await admin.firestore().collection('_mnemonic').doc(address).set({
      mnemonic: AES.encrypt(mnemonic, salt).toString()
    });
  }

  public static async get(address: string): Promise<string> {
    const salt = functions.config().encryption.salt || defaultSalt;
    const doc: any = await admin.firestore().collection('_mnemonic').doc(address).get();
    return AES.decrypt(doc!.data().mnemonic, salt).toString(CryptoJS.enc.Utf8);
  }
}
