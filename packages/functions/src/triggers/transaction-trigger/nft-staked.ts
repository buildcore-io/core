import { build5Db } from '@build-5/database';
import { COL, Nft, Transaction } from '@build-5/interfaces';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onNftStaked = async (transaction: Transaction) => {
  const nftDocRef = build5Db().doc(`${COL.NFT}/${transaction.payload.nft}`);
  const nft = (await nftDocRef.get<Nft>())!;

  const nftStake = {
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: nft.space,
    nft: nft.uid,
    collection: nft.collection,
    weeks: transaction.payload.weeks,
    expiresAt: transaction.payload.vestingAt,
    expirationProcessed: false,
    type: transaction.payload.stakeType,
  };

  const batch = build5Db().batch();

  const nftStakeDocRef = build5Db().doc(`${COL.NFT_STAKE}/${nftStake.uid}`);
  batch.create(nftStakeDocRef, nftStake);

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
  batch.update(collectionDocRef, { stakedNft: build5Db().inc(1) });

  await batch.commit();
};
