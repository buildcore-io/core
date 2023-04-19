import { COL, NftStake } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';

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
  return soonDb()
    .collection(COL.NFT_STAKE)
    .where('expiresAt', '<=', dayjs().toDate())
    .where('expirationProcessed', '==', false)
    .startAfter(lastDoc)
    .limit(1000);
};

const processExpiredNftStake = async (nftStakeId: string) =>
  soonDb().runTransaction(async (transaction) => {
    const nftStakeDocRef = soonDb().doc(`${COL.NFT_STAKE}/${nftStakeId}`);
    const nftStake = (await transaction.get<NftStake>(nftStakeDocRef))!;

    if (!nftStake.expirationProcessed) {
      const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nftStake.collection}`);
      transaction.update(collectionDocRef, { stakedNft: soonDb().inc(-1) });
      transaction.update(nftStakeDocRef, { expirationProcessed: true });
    }
  });
