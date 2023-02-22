import { COL, Collection, Network, TokenStatus } from '@soonaverse/interfaces';
import admin from '../../../src/admin.config';
import { XP_TO_SHIMMER } from '../../../src/firebase/functions/dbRoll/award.roll';
import { collectionDiscountRoll } from '../../../src/firebase/functions/dbRoll/colletion.discounts.roll';
import { xpTokenGuardianId, xpTokenId, xpTokenUid } from '../../../src/utils/config.utils';
import { serverTime } from '../../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Collection discount roll', () => {
  beforeEach(async () => {
    const xpToken = {
      symbol: 'XPT',
      approved: true,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: 'asd',
      uid: xpTokenUid(),
      createdBy: xpTokenGuardianId(),
      name: 'xptoken',
      status: TokenStatus.MINTED,
      access: 0,
      mintingData: {
        network: Network.RMS,
        tokenId: xpTokenId(),
      },
    };
    await admin.firestore().doc(`${COL.TOKEN}/${xpToken.uid}`).set(xpToken);
    return xpToken;
  });

  it('Should roll collection discounts', async () => {
    const collectionId = getRandomEthAddress();
    const discounts = [
      { xp: 10, amount: 0.5 },
      { xp: 30, amount: 0.1 },
    ];

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collectionId}`);
    await collectionDocRef.create({ uid: collectionId, discounts });

    const req = { body: {} } as any;
    const res = { sendStatus: () => {} } as any;
    await collectionDiscountRoll(req, res);

    const collection = <Collection>(await collectionDocRef.get()).data();
    expect(collection.discounts).toEqual([
      {
        tokenUid: xpTokenUid(),
        tokenSymbol: 'XPT',
        tokenReward: 10 * XP_TO_SHIMMER,
        amount: 0.5,
      },
      {
        tokenUid: xpTokenUid(),
        tokenSymbol: 'XPT',
        tokenReward: 30 * XP_TO_SHIMMER,
        amount: 0.1,
      },
    ]);
  });
});
