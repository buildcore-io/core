import * as admin from 'firebase-admin';

export class MnemonicService {
  public static async store(address: string, mnemonic: string): Promise<void> {
    await admin.firestore().collection('_mnemonic').doc(address).set({
      mnemonic: mnemonic
    });
  }

  public static async get(address: string): Promise<string> {
    const doc: any = await admin.firestore().collection('_mnemonic').doc(address).get();
    return doc!.data().mnemonic;
  }
}
