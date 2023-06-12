import { COL, Nft, Transaction } from '@build5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onNftStaked = async (transaction: Transaction) => {
  const nftDocRef = soonDb().doc(`${COL.NFT}/${transaction.payload.nft}`);
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

  const batch = soonDb().batch();

  const nftStakeDocRef = soonDb().doc(`${COL.NFT_STAKE}/${nftStake.uid}`);
  batch.create(nftStakeDocRef, nftStake);

  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft.collection}`);
  batch.update(collectionDocRef, { stakedNft: soonDb().inc(1) });

  await batch.commit();
};
