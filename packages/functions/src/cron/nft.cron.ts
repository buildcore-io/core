import { COL, Nft } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../admin.config';
import { ProcessingService } from '../services/payment/payment-processing';

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
