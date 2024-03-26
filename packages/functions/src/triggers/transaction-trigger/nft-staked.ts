import { PgTransaction, build5Db } from '@build-5/database';
import { COL, StakeType } from '@build-5/interfaces';
import { getProject } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onNftStaked = async (transaction: PgTransaction) => {
  const nftDocRef = build5Db().doc(COL.NFT, transaction.payload_nft!);
  const nft = (await nftDocRef.get())!;

  const nftStake = {
    project: getProject(transaction),
    uid: getRandomEthAddress(),
    member: transaction.member!,
    space: nft.space,
    nft: nft.uid,
    collection: nft.collection,
    weeks: transaction.payload_weeks!,
    expiresAt: dateToTimestamp(transaction.payload_vestingAt!),
    expirationProcessed: false,
    type: transaction.payload_stakeType as StakeType,
  };

  const batch = build5Db().batch();

  const nftStakeDocRef = build5Db().doc(COL.NFT_STAKE, nftStake.uid);
  batch.create(nftStakeDocRef, nftStake);

  const collectionDocRef = build5Db().doc(COL.COLLECTION, nft.collection);
  batch.update(collectionDocRef, { stakedNft: build5Db().inc(1) });

  await batch.commit();
};
