import { build5Db, getSnapshot } from '@build-5/database';
import { COL, NftStake } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';

export const processExpiredNftStakes = async () => {
  let lastDocId = '';
  do {
    const query = await getExpiredNftStakesQuery(lastDocId);
    const snap = await query.get<NftStake>();
    lastDocId = last(snap)?.uid || '';

    const promises = snap.map((stake) => processExpiredNftStake(stake.uid));
    await Promise.all(promises);
  } while (lastDocId);
};

const getExpiredNftStakesQuery = async (lastDocId = '') => {
  const lastDoc = await getSnapshot(COL.NFT_STAKE, lastDocId);
  return build5Db()
    .collection(COL.NFT_STAKE)
    .where('expiresAt', '<=', dayjs().toDate())
    .where('expirationProcessed', '==', false)
    .startAfter(lastDoc)
    .limit(1000);
};

const processExpiredNftStake = async (nftStakeId: string) =>
  build5Db().runTransaction(async (transaction) => {
    const nftStakeDocRef = build5Db().doc(`${COL.NFT_STAKE}/${nftStakeId}`);
    const nftStake = (await transaction.get<NftStake>(nftStakeDocRef))!;

    if (!nftStake.expirationProcessed) {
      const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nftStake.collection}`);
      transaction.update(collectionDocRef, { stakedNft: build5Db().inc(-1) });
      transaction.update(nftStakeDocRef, { expirationProcessed: true });
    }
  });
