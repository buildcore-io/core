import { COL, Nft, TransactionType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { nftSoldOnRoll } from '../../../scripts/dbUpgrades/0.18/nft.sold.on.fix';
import admin from '../../../src/admin.config';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Nft sold on', () => {
  it('Should set sold on date', async () => {
    const now = dayjs();
    let nft = {
      uid: getRandomEthAddress(),
      sold: true,
      soldOn: dateToTimestamp(now.add(1, 'd')),
    };
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    await nftDocRef.create(nft);

    const transactions = [
      {
        uid: getRandomEthAddress(),
        createdOn: dateToTimestamp(now.subtract(1, 'd')),
        type: TransactionType.CREDIT,
        payload: { nft: nft.uid },
      },
      {
        uid: getRandomEthAddress(),
        createdOn: dateToTimestamp(now.subtract(1, 'd')),
        type: TransactionType.CREDIT,
        payload: { nft: 'asd' },
      },
      {
        uid: getRandomEthAddress(),
        createdOn: dateToTimestamp(now.subtract(1, 'h')),
        type: TransactionType.BILL_PAYMENT,
        payload: { nft: nft.uid },
      },
      {
        uid: getRandomEthAddress(),
        createdOn: dateToTimestamp(now.subtract(2, 'h')),
        type: TransactionType.BILL_PAYMENT,
        payload: { nft: nft.uid },
      },
    ];
    for (const trans of transactions) {
      const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${trans.uid}`);
      await docRef.create(trans);
    }

    await nftSoldOnRoll(admin.app());

    const updatedNft = <Nft>(await nftDocRef.get()).data();
    expect(updatedNft.soldOn).toEqual(dateToTimestamp(now.subtract(2, 'h')));
  });
});
