import { COL, Network, Space } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { isEmpty, last } from 'lodash';
import admin from '../admin.config';
import { WalletService } from '../services/wallet/wallet';
import { LastDocType } from '../utils/common.utils';
import { isProdEnv } from '../utils/config.utils';
import { uOn } from '../utils/dateTime.utils';

export const spaceVaultAddressDbRoller = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onCall(async () => {
    const wallet = await WalletService.newWallet(isProdEnv() ? Network.SMR : Network.RMS);
    let lastDoc: LastDocType | undefined = undefined;
    do {
      let query = admin.firestore().collection(COL.SPACE).limit(500);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap = await query.get();
      const batch = admin.firestore().batch();
      for (const doc of snap.docs) {
        if (isEmpty((<Space>doc.data()).vaultAddress)) {
          const vaultAddress = (await wallet.getNewIotaAddressDetails()).bech32;
          batch.update(doc.ref, uOn({ vaultAddress }));
        }
      }
      await batch.commit();
      lastDoc = last(snap.docs);
    } while (lastDoc);
  });
