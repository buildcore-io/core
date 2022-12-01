import { COL, Nft } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../admin.config';
import { ProcessingService } from '../services/payment/payment-processing';
import { uOn } from '../utils/dateTime.utils';

const finalizeNftAuction = (nftId: string) =>
  admin.firestore().runTransaction(async (transaction) => {
    const refSource = admin.firestore().collection(COL.NFT).doc(nftId);
    const sfDoc = await transaction.get(refSource);
    const service = new ProcessingService(transaction);
    await service.markNftAsFinalized(<Nft>sfDoc.data());
    service.submit();
  });

export const finalizeAllNftAuctions = async () => {
  const snap = await admin
    .firestore()
    .collection(COL.NFT)
    .where('auctionTo', '<=', dayjs().toDate())
    .get();
  const promises = snap.docs.map((d) => finalizeNftAuction(d.id));
  await Promise.all(promises);
};

export const hidePlaceholderAfterSoldOutCron = async () => {
  const qry = await admin
    .firestore()
    .collection(COL.NFT)
    .where('sold', '==', true)
    .where('placeholderNft', '==', true)
    .where('availableFrom', '==', null)
    .where('hidden', '==', false)
    .where('owner', '==', null)
    .get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      if (
        t.data().soldOn &&
        t.data().soldOn.toDate() &&
        dayjs(t.data().soldOn.toDate()).isBefore(dayjs().add(24, 'hours'))
      ) {
        await admin
          .firestore()
          .collection(COL.NFT)
          .doc(t.data().uid)
          .update(
            uOn({
              hidden: true,
            }),
          );
      }
    }
  }

  // Finished.
  return null;
};
