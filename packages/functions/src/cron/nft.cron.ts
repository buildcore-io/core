import { build5Db } from '@build-5/database';
import { COL, Nft } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { NftBidService } from '../services/payment/nft/nft-bid.service';
import { TransactionService } from '../services/payment/transaction-service';

const finalizeNftAuction = (nftId: string) =>
  build5Db().runTransaction(async (transaction) => {
    const nftDocRef = build5Db().collection(COL.NFT).doc(nftId);
    const nft = (await transaction.get<Nft>(nftDocRef))!;

    const tranService = new TransactionService(transaction);
    const service = new NftBidService(tranService);
    await service.markNftAsFinalized(nft);
    tranService.submit();
  });

export const finalizeAllNftAuctions = async () => {
  const snap = await build5Db()
    .collection(COL.NFT)
    .where('auctionTo', '<=', dayjs().toDate())
    .get<Nft>();
  const promises = snap.map((d) => finalizeNftAuction(d.uid));
  await Promise.all(promises);
};

export const hidePlaceholderAfterSoldOutCron = async () => {
  const snap = await build5Db()
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
      await build5Db().collection(COL.NFT).doc(nft.uid).update({
        hidden: true,
      });
    }
  }

  return null;
};
