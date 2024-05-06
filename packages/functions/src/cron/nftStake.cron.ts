import { database } from '@buildcore/database';
import { COL } from '@buildcore/interfaces';
import dayjs from 'dayjs';

export const processExpiredNftStakes = async () => {
  const snap = await database()
    .collection(COL.NFT_STAKE)
    .where('expiresAt', '<=', dayjs().toDate())
    .where('expirationProcessed', '==', false)
    .get();
  const promises = snap.map((stake) => processExpiredNftStake(stake.uid));
  await Promise.all(promises);
};

const processExpiredNftStake = (nftStakeId: string) =>
  database().runTransaction(async (transaction) => {
    const nftStakeDocRef = database().doc(COL.NFT_STAKE, nftStakeId);
    const nftStake = (await transaction.get(nftStakeDocRef))!;

    if (!nftStake.expirationProcessed) {
      const collectionDocRef = database().doc(COL.COLLECTION, nftStake.collection);
      await transaction.update(collectionDocRef, { stakedNft: database().inc(-1) });
      await transaction.update(nftStakeDocRef, { expirationProcessed: true });
    }
  });
