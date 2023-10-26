import { build5Db } from '@build-5/database';
import { Auction, AuctionType, COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { AuctionFinalizeService } from '../services/payment/auction/auction.finalize.service';
import { TransactionService } from '../services/payment/transaction-service';

export const finalizeAuctions = async () => {
  const snap = await build5Db()
    .collection(COL.AUCTION)
    .where('auctionTo', '<=', dayjs().toDate())
    .where('active', '==', true)
    .get<Auction>();
  const promises = snap.map(async (a) => {
    if (a.type === AuctionType.NFT) {
      await finalizeNftAuction(a.uid);
    }
  });
  await Promise.all(promises);
};

const finalizeNftAuction = (auction: string) =>
  build5Db().runTransaction(async (transaction) => {
    const tranService = new TransactionService(transaction);
    const service = new AuctionFinalizeService(tranService);
    await service.markAsFinalized(auction);
    tranService.submit();
  });
