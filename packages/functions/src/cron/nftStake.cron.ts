import { build5Db } from '@build-5/database';
import { COL } from '@build-5/interfaces';
import dayjs from 'dayjs';

export const processExpiredNftStakes = async () => {
  const snap = await build5Db()
    .collection(COL.NFT_STAKE)
    .where('expiresAt', '<=', dayjs().toDate())
    .where('expirationProcessed', '==', false)
    .get();
  const promises = snap.map((stake) => processExpiredNftStake(stake.uid));
  await Promise.all(promises);
};

const processExpiredNftStake = (nftStakeId: string) =>
  build5Db().runTransaction(async (transaction) => {
    const nftStakeDocRef = build5Db().doc(COL.NFT_STAKE, nftStakeId);
    const nftStake = (await transaction.get(nftStakeDocRef))!;

    if (!nftStake.expirationProcessed) {
      const collectionDocRef = build5Db().doc(COL.COLLECTION, nftStake.collection);
      await transaction.update(collectionDocRef, { stakedNft: build5Db().inc(-1) });
      await transaction.update(nftStakeDocRef, { expirationProcessed: true });
    }
  });
