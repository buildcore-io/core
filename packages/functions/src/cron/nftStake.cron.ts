import { COL, NftStake } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';
import admin, { inc } from '../admin.config';
import { LastDocType } from '../utils/common.utils';
import { uOn } from '../utils/dateTime.utils';

export const processExpiredNftStakes = async () => {
  let lastDoc: LastDocType | undefined = undefined;
  do {
    const query = getExpiredNftStakesQuery(lastDoc);
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map((d) => processExpiredNftStake(d.id));
    await Promise.all(promises);
  } while (lastDoc);
};

const getExpiredNftStakesQuery = (lastDoc?: LastDocType) => {
  const query = admin
    .firestore()
    .collection(COL.NFT_STAKE)
    .where('expiresAt', '<=', dayjs().toDate())
    .where('expirationProcessed', '==', false)
    .limit(1000);
  if (lastDoc) {
    return query.startAfter(lastDoc);
  }
  return query;
};

const processExpiredNftStake = async (nftStakeId: string) =>
  admin.firestore().runTransaction(async (transaction) => {
    const nftStakeDocRef = admin.firestore().doc(`${COL.NFT_STAKE}/${nftStakeId}`);
    const nftStake = <NftStake>(await transaction.get(nftStakeDocRef)).data();

    if (!nftStake.expirationProcessed) {
      const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nftStake.collection}`);
      transaction.update(collectionDocRef, uOn({ stakedNft: inc(-1) }));
      transaction.update(nftStakeDocRef, uOn({ expirationProcessed: true }));
    }
  });
