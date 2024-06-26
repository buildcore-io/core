import { database } from '@buildcore/database';
import { COL, Collection, NftStake, SOON_PROJECT_ID, StakeType } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { processExpiredNftStakes } from '../../src/cron/nftStake.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Expired nft stake cron', () => {
  beforeAll(() => {});
  it('Should process expired nft stake', async () => {
    const collection = getRandomEthAddress();
    const collectionDocRef = database().doc(COL.COLLECTION, collection);
    await collectionDocRef.create({
      project: SOON_PROJECT_ID,
      uid: collection,
      name: 'name',
      stakedNft: 2,
    } as Collection);
    let nftStake: NftStake = {
      project: SOON_PROJECT_ID,
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
    await database().doc(COL.NFT_STAKE, nonExpiredStake.uid).create(nonExpiredStake);
    const stakeDocRef = database().doc(COL.NFT_STAKE, nftStake.uid);
    await stakeDocRef.create(nftStake);
    const promises = [processExpiredNftStakes(), processExpiredNftStakes()];
    await Promise.all(promises);
    const collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.stakedNft).toBe(1);
    nftStake = <NftStake>await stakeDocRef.get();
    expect(nftStake.expirationProcessed).toBe(true);
  });
});
