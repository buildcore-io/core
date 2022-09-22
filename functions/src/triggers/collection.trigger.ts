import * as functions from 'firebase-functions';
import { last } from 'lodash';
import { DEFAULT_NETWORK } from '../../interfaces/config';
import { WEN_FUNC } from '../../interfaces/functions';
import { Collection, CollectionStatus, Member, Transaction, TransactionMintCollectionType, TransactionType, UnsoldMintingOptions } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { Nft } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { getAddress } from '../utils/address.utils';
import { serverTime } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const collectionWrite = functions.runWith({
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC.collectionWrite),
  memory: "1GB"
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

  if (prev.status === CollectionStatus.PRE_MINTED && curr.status === CollectionStatus.MINTING) {
    await onCollectionMinting(curr)
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

const onCollectionMinting = async (collection: Collection) => {
  await updateNftsForMinting(collection)
  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: collection.mintingData?.mintedBy!,
    space: collection.space,
    createdOn: serverTime(),
    network: collection.mintingData?.network,
    payload: {
      type: TransactionMintCollectionType.MINT_ALIAS,
      amount: collection.mintingData?.aliasStorageDeposit || 0,
      sourceAddress: collection.mintingData?.address,
      collection: collection.uid,
      collectionStorageDeposit: collection.mintingData?.storageDeposit
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
}

const BATCH_SIZE = 1000
const updateNftsForMinting = async (collection: Collection) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any = undefined
  do {
    let query = admin.firestore().collection(COL.NFT).where('collection', '==', collection.uid).limit(BATCH_SIZE)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    const snap = await query.get()
    const allNfts = snap.docs.map(d => <Nft>d.data())
    if (collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD) {
      const nftsToBurn = allNfts.filter(nft => !nft.sold)
      const promises = nftsToBurn.map(nft => admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete())
      await Promise.all(promises)
      await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).update({
        total: admin.firestore.FieldValue.increment(-nftsToBurn.length)
      })
    }
    const nftsToMint = collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD ? allNfts.filter(nft => nft.sold) : allNfts
    const promises = nftsToMint.map(nft => setNftForMinting(nft.uid, collection))
    await Promise.all(promises)

    lastDoc = last(snap.docs)
  } while (lastDoc !== undefined)
}


const setNftForMinting = (nftId: string, collection: Collection) =>
  admin.firestore().runTransaction(async (transaction) => {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`)
    const nft = <Nft>(await transaction.get(nftDocRef)).data()

    if (nft.auctionHighestTransaction) {
      const highestTransaction = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`).get()).data()
      const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${nft.auctionHighestBidder}`).get()).data()
      const credit = <Transaction>{
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: highestTransaction.space,
        member: highestTransaction.member,
        createdOn: serverTime(),
        network: highestTransaction.network || DEFAULT_NETWORK,
        payload: {
          amount: highestTransaction.payload.amount,
          sourceAddress: highestTransaction.payload.targetAddress,
          targetAddress: getAddress(member, highestTransaction.network || DEFAULT_NETWORK),
          sourceTransaction: [highestTransaction.uid],
          nft: nft.uid,
          collection: nft.collection,
        }
      };
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`), credit)
    }

    const nftUpdateData = <Nft>{
      auctionFrom: null,
      auctionTo: null,
      auctionFloorPrice: null,
      auctionLength: null,
      auctionHighestBid: null,
      auctionHighestBidder: null,
      auctionHighestTransaction: null
    }
    if (nft.sold) {
      nftUpdateData.availableFrom = null;
      nftUpdateData.availablePrice = null;
      nftUpdateData.price = 0;
    }
    else {
      if (collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE) {
        nftUpdateData.price = collection.mintingData?.newPrice || nftUpdateData.price
      }
      if (collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP) {
        nftUpdateData.owner = collection.mintingData?.mintedBy!;
        nftUpdateData.isOwned = true;
        nftUpdateData.sold = true;
        nftUpdateData.availableFrom = null;
        nftUpdateData.availablePrice = null;
        nftUpdateData.price = 0;
      }
    }
    transaction.update(nftDocRef, nftUpdateData)
  })
