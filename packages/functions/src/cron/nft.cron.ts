import { COL, Nft } from '@build5/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../firebase/firestore/soondb';
import { ProcessingService } from '../services/payment/payment-processing';

const finalizeNftAuction = (nftId: string) =>
  soonDb().runTransaction(async (transaction) => {
    const nftDocRef = soonDb().collection(COL.NFT).doc(nftId);
    const nft = (await transaction.get<Nft>(nftDocRef))!;
    const service = new ProcessingService(transaction);
    await service.markNftAsFinalized(nft);
    service.submit();
  });

export const finalizeAllNftAuctions = async () => {
  const snap = await soonDb()
    .collection(COL.NFT)
    .where('auctionTo', '<=', dayjs().toDate())
    .get<Nft>();
  const promises = snap.map((d) => finalizeNftAuction(d.uid));
  await Promise.all(promises);
};

export const hidePlaceholderAfterSoldOutCron = async () => {
  const snap = await soonDb()
    .collection(COL.NFT)
    .where('sold', '==', true)
    .where('placeholderNft', '==', true)
    .where('availableFrom', '==', null)
    .where('hidden', '==', false)
    .where('owner', '==', null)
    .get<Nft>();
  for (const nft of snap) {
    if (
      nft.soldOn &&
      nft.soldOn.toDate() &&
      dayjs(nft.soldOn.toDate()).isBefore(dayjs().add(24, 'hours'))
    ) {
      await soonDb().collection(COL.NFT).doc(nft.uid).update({
        hidden: true,
      });
    }
  }

  return null;
};
