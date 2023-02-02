import { COL, Nft, Transaction } from '@soonaverse/interfaces';
import admin, { inc } from '../../admin.config';
import { cOn, uOn } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onNftStaked = async (transaction: Transaction) => {
  const nftDocRef = admin.firestore().doc(`${COL.NFT}/${transaction.payload.nft}`);
  const nft = <Nft>(await nftDocRef.get()).data();

  const nftStake = {
    uid: getRandomEthAddress(),
    member: nft.owner!,
    space: nft.space,
    nft: nft.uid,
    collection: nft.collection,
    weeks: transaction.payload.weeks,
    expiresAt: transaction.payload.vestingAt,
    expirationProcessed: false,
    type: transaction.payload.stakeType,
  };

  const batch = admin.firestore().batch();

  const nftStakeDocRef = admin.firestore().doc(`${COL.NFT_STAKE}/${nftStake.uid}`);
  batch.create(nftStakeDocRef, cOn(nftStake));

  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
  batch.update(collectionDocRef, uOn({ stakedNft: inc(1) }));

  await batch.commit();
};
