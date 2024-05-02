import { database } from '@buildcore/database';
import {
  Auction,
  AuctionType,
  COL,
  Member,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { AuctionFinalizeService } from '../services/payment/auction/auction.finalize.service';
import { TransactionService } from '../services/payment/transaction-service';
import { getAddress } from '../utils/address.utils';
import { getProject } from '../utils/common.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const finalizeAuctions = async () => {
  const snap = await database()
    .collection(COL.AUCTION)
    .where('auctionTo', '<=', dayjs().toDate())
    .where('active', '==', true)
    .get();
  const promises = snap.map((a) => {
    switch (a.type) {
      case AuctionType.NFT:
        return finalizeNftAuction(a.uid);
      case AuctionType.OPEN:
        return finalizeOpenAuction(a);
    }
  });
  await Promise.all(promises);
};

const finalizeNftAuction = (auction: string) =>
  database().runTransaction(async (transaction) => {
    const tranService = new TransactionService(transaction);
    const service = new AuctionFinalizeService(tranService);
    await service.markAsFinalized(auction);
    await tranService.submit();
  });

const finalizeOpenAuction = async (auction: Auction) => {
  const batch = database().batch();

  let targetAddress = auction.targetAddress;
  if (!targetAddress) {
    const memberDocRef = database().doc(COL.MEMBER, auction.createdBy!);
    const member = <Member>await memberDocRef.get();
    targetAddress = getAddress(member, auction.network);
  }

  const payments = await database()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.PAYMENT)
    .where('payload_invalidPayment', '==', false)
    .where('payload_auction', '==', auction.uid)
    .get();

  for (const payment of payments) {
    const billPayment: Transaction = {
      project: getProject(payment),
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: auction.space,
      member: payment.member,
      network: payment.network,
      payload: {
        amount: payment.payload.amount!,
        sourceAddress: payment.payload.targetAddress,
        targetAddress,
        sourceTransaction: [payment.uid],
        reconciled: true,
        royalty: false,
        void: false,
        auction: auction.uid,
      },
    };
    const billPaymentDocRef = database().doc(COL.TRANSACTION, billPayment.uid);
    batch.create(billPaymentDocRef, billPayment);
  }

  await batch.commit();
};
