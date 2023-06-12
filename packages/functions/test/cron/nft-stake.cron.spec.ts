import { COL, Collection, NftStake, StakeType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { processExpiredNftStakes } from '../../src/cron/nftStake.cron';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Expired nft stake cron', () => {
  it('Should process expired nft stake', async () => {
    const collection = getRandomEthAddress();
    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collection}`);
    await collectionDocRef.create({ uid: collection, name: 'asd', stakedNft: 2 });

    let nftStake = {
      uid: getRandomEthAddress(),
      member: getRandomEthAddress(),
      space: getRandomEthAddress(),
      nft: getRandomEthAddress(),
      collection: collection,
      weeks: 25,
      expiresAt: dateToTimestamp(dayjs().subtract(2, 'd')),
      expirationProcessed: false,
      type: StakeType.DYNAMIC,
    };
    const nonExpiredStake = {
      ...nftStake,
      uid: getRandomEthAddress(),
      expiresAt: dateToTimestamp(dayjs().add(2, 'd')),
    };
    await soonDb().doc(`${COL.NFT_STAKE}/${nonExpiredStake.uid}`).create(nonExpiredStake);

    const stakeDocRef = soonDb().doc(`${COL.NFT_STAKE}/${nftStake.uid}`);
    await stakeDocRef.create(nftStake);

    const promises = [processExpiredNftStakes(), processExpiredNftStakes()];
    await Promise.all(promises);

    const collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.stakedNft).toBe(1);

    nftStake = <NftStake>await stakeDocRef.get();
    expect(nftStake.expirationProcessed).toBe(true);
  });
});
