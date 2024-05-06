import { PgTransaction, database } from '@buildcore/database';
import { COL, StakeType } from '@buildcore/interfaces';
import { getProject } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onNftStaked = async (transaction: PgTransaction) => {
  const nftDocRef = database().doc(COL.NFT, transaction.payload_nft!);
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

  const batch = database().batch();

  const nftStakeDocRef = database().doc(COL.NFT_STAKE, nftStake.uid);
  batch.create(nftStakeDocRef, nftStake);

  const collectionDocRef = database().doc(COL.COLLECTION, nft.collection);
  batch.update(collectionDocRef, { stakedNft: database().inc(1) });

  await batch.commit();
};
