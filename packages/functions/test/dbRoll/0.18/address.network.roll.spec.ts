import { COL, Mnemonic, Network } from '@soonaverse/interfaces';
import { addressNetworkRoll } from '../../../scripts/dbUpgrades/address.network.roll';
import admin from '../../../src/admin.config';
import { WalletService } from '../../../src/services/wallet/wallet';

describe('Roll address network', () => {
  it('Should roll address network', async () => {
    const mnemonics: any[] = [];
    for (const network of Object.values(Network)) {
      const wallet = await WalletService.newWallet(network);
      const address = await wallet.getNewIotaAddressDetails();
      const docRef = admin.firestore().doc(`${COL.MNEMONIC}/${address.bech32}`);

      const mnemonic = (await docRef.get()).data() as Mnemonic;
      mnemonics.push({ ...mnemonic, uid: address.bech32 });
      await docRef.update({ network: admin.firestore.FieldValue.delete() });
    }

    await addressNetworkRoll(admin.app());

    for (const mnemonic of mnemonics) {
      const docRef = admin.firestore().doc(`${COL.MNEMONIC}/${mnemonic.uid}`);
      const data = (await docRef.get()).data()!;
      expect(data.mnemonic).toBe(mnemonic.mnemonic);
      expect(data.network).toBe(mnemonic.network);
    }
  });
});
