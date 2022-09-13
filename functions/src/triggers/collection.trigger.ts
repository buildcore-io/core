import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../interfaces/functions';
import { Collection, Member, Transaction, TransactionChangeNftOrderType, TransactionType } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { Nft } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { getAddress } from '../utils/address.utils';
import { serverTime } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

// Listen for changes in all documents in the 'users' collection
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
  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${collection.mintingData?.mintedBy}`).get()).data()
  const order = <Transaction>{
    type: TransactionType.CHANGE_NFT_OWNER,
    uid: getRandomEthAddress(),
    member: collection.mintingData?.mintedBy,
    space: collection.space,
    createdOn: serverTime(),
    network: collection.mintingData?.network,
    payload: {
      type: TransactionChangeNftOrderType.SEND_COLLECTION_NFT_TO_GUARDIAN,
      sourceAddress: collection.mintingData?.address,
      targetAddress: getAddress(member, collection.mintingData?.network!),
      collection: collection.uid
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
}