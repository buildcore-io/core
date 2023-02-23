import {
  Base,
  COL,
  Collection,
  Nft,
  TransactionOrderType,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { rollNftTradeStats } from '../../../scripts/dbUpgrades/0_18/w_nft.trade.stat.roll';
import admin from '../../../src/admin.config';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Nft trade stats', () => {
  const now = dayjs();

  const saveEntity = async <T extends Base>(col: COL, array: T[]) => {
    for (const entity of array) {
      await admin.firestore().doc(`${col}/${entity.uid}`).create(entity);
    }
  };

  const createOrdersAndBillPayments = async (member: string, nfts: Nft[], multiplier = 1) => {
    const orders = nfts.map((nft, index) => ({
      createdBy: member,
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      payload: {
        type: index > 5 ? TransactionOrderType.NFT_BID : TransactionOrderType.NFT_PURCHASE,
        nft: nft.uid,
      },
    }));
    const billPayments = orders.map((order, index) => ({
      createdBy: member,
      uid: getRandomEthAddress(),
      type: TransactionType.BILL_PAYMENT,
      createdOn: dateToTimestamp(now.subtract(index * multiplier, 'd')),
      payload: {
        nft: order.payload.nft,
        sourceTransaction: [order.uid],
      },
    }));
    await saveEntity(COL.TRANSACTION, orders);
    await saveEntity(COL.TRANSACTION, billPayments);
  };

  it('Should set nft trade stats', async () => {
    const count = 10;
    const member = getRandomEthAddress();
    const collection = { createdBy: member, uid: getRandomEthAddress() };
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`);
    await collectionDocRef.create(collection);

    const nfts = Array.from(Array(count)).map(() => ({
      uid: getRandomEthAddress(),
      createdBy: member,
      collection: collection.uid,
    }));
    await saveEntity(COL.NFT, nfts);

    await createOrdersAndBillPayments(member, <Nft[]>nfts, 1);
    await createOrdersAndBillPayments(member, <Nft[]>nfts, 2);

    await rollNftTradeStats(admin.app());

    for (let i = 0; i < nfts.length; ++i) {
      const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nfts[i].uid}`);
      const nft = <Nft>(await nftDocRef.get()).data();
      expect(nft.totalTrades).toBe(2);
      expect(dayjs(nft.lastTradedOn?.toDate()).unix()).toBe(now.subtract(i, 'd').unix());
    }

    const collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.totalTrades).toBe(2 * count);
    expect(dayjs(collectionData.lastTradedOn?.toDate()).unix()).toBe(now.unix());
  });
});
