import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../interfaces/functions';
import { Collection, Member, Transaction, TransactionMintCollectionType, TransactionType } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { Nft } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { getAddress } from '../utils/address.utils';
import { serverTime } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const collectionWrite = functions.runWith({
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC.collectionWrite)
}).firestore.document(COL.COLLECTION + '/{collectionId}').onUpdate(async (change) => {
  const prev = <Collection>change.before.data();
  const curr = <Collection>change.after.data();
  if (!curr) {
    return
  }

  if ((curr.approved !== prev.approved) || (curr.rejected !== prev.rejected)) {
    await updateNftApprovalState(curr.uid)
  }

  if (prev.mintingData?.nftsToMint !== 0 && curr.mintingData?.nftsToMint === 0) {
    await onCollectionMinted(curr)
  }

});

const updateNftApprovalState = async (collectionId: string) => {
  const snap = await admin.firestore().collection(COL.NFT).where('collection', '==', collectionId).get();
  for (const doc of snap.docs) {
    await admin.firestore().runTransaction(async (transaction) => {
      const nftDocRef = admin.firestore().collection(COL.NFT).doc(doc.id);
      const nft = <Nft>(await transaction.get(nftDocRef)).data();
      const collectionDocRef = admin.firestore().collection(COL.COLLECTION).doc(nft.collection);
      const collection = <Collection | undefined>(await transaction.get(collectionDocRef)).data();

      transaction.update(nftDocRef, {
        approved: collection?.approved || false,
        rejected: collection?.rejected || false,
      });
    });
  }
}

const onCollectionMinted = async (collection: Collection) => {
  if (collection.limitedEdition) {
    const order = <Transaction>{
      type: TransactionType.MINT_COLLECTION,
      uid: getRandomEthAddress(),
      member: collection.mintingData?.mintedBy,
      space: collection.space,
      createdOn: serverTime(),
      network: collection.mintingData?.network,
      payload: {
        type: TransactionMintCollectionType.LOCK_COLLECTION,
        amount: 0,
        sourceAddress: collection.mintingData?.address,
        collection: collection.uid,
        aliasStorageDeposit: collection.mintingData?.aliasStorageDeposit || 0
      }
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
    return
  }
  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${collection.mintingData?.mintedBy}`).get()).data()
  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: collection.mintingData?.mintedBy,
    space: collection.space,
    createdOn: serverTime(),
    network: collection.mintingData?.network,
    payload: {
      type: TransactionMintCollectionType.SENT_ALIAS_TO_GUARDIAN,
      amount: collection.mintingData?.aliasStorageDeposit,
      sourceAddress: collection.mintingData?.address,
      targetAddress: getAddress(member, collection.mintingData?.network!),
      collection: collection.uid,
      lockCollectionNft: collection.limitedEdition || false
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
}