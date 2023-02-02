import { COL, SUB_COL } from '@soonaverse/interfaces';
import { setVotesOnParent } from '../../../scripts/dbUpgrades/0_17/votes.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Votes roller spec', () => {
  const createParentAndVotes = async (col: COL, uid: string) => {
    const parentDocRef = admin.firestore().doc(`${col}/${uid}`);
    const statsDocRef = parentDocRef.collection(SUB_COL.STATS).doc(uid);
    await parentDocRef.create({ uid, name: col });
    await statsDocRef.create({ votes: { upvote: 1, downvote: 10, voteDiff: -9 } });
  };

  const assertParentVotes = async (col: COL, uid: string) => {
    const parentDocRef = admin.firestore().doc(`${col}/${uid}`);
    const parent = (await parentDocRef.get()).data()!;
    expect(parent.votes.upvote).toBe(1);
    expect(parent.votes.downvote).toBe(10);
    expect(parent.votes.voteDiff).toBe(-9);
  };

  it('Should set votes on parent doc', async () => {
    const collectionId = getRandomEthAddress();
    await createParentAndVotes(COL.COLLECTION, collectionId);
    const tokenId = getRandomEthAddress();
    await createParentAndVotes(COL.TOKEN, tokenId);

    await setVotesOnParent(admin.app(), COL.COLLECTION);
    await setVotesOnParent(admin.app(), COL.TOKEN);

    await assertParentVotes(COL.COLLECTION, collectionId);
    await assertParentVotes(COL.TOKEN, tokenId);
  });
});
