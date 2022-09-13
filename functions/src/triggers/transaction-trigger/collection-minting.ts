import { Collection, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Nft } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";

const NFT_MINT_BATCH_SIZE = 100

export const createNftMintingOrdersForCollection = async (transaction: Transaction) => {
  const collection = <Collection>(await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).get()).data()
  const nfts = (await admin.firestore().collection(COL.NFT).where('collection', '==', transaction.payload.collection).get())
    .docs.map(doc => <Nft>doc.data())

  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.mintedBy': transaction.member,
    'mintingData.mintedOn': serverTime(),
    'mintingData.nftsToMint': nfts.length,
    'mintingData.address': transaction.payload.sourceAddress,
  })

  const createNftMintTran = () => <Transaction>{
    type: TransactionType.MINT_NFTS,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: collection.space,
    createdOn: serverTime(),
    network: transaction.network,
    payload: {
      sourceAddress: transaction.payload.sourceAddress,
      collection: collection.uid,
      nfts: []
    }
  }

  let count = 0
  let nftMintTransaction = createNftMintTran()
  for (const nft of nfts) {
    if (count < NFT_MINT_BATCH_SIZE) {
      nftMintTransaction.payload.nfts.push(nft.uid)
      ++count
      continue;
    }

    await admin.firestore().doc(`${COL.TRANSACTION}/${nftMintTransaction.uid}`).create(nftMintTransaction)
    nftMintTransaction = createNftMintTran()
    nftMintTransaction.payload.nfts.push(nft.uid)
    count = 1;
  }
  if (count) {
    await admin.firestore().doc(`${COL.TRANSACTION}/${nftMintTransaction.uid}`).create(nftMintTransaction)
  }
}
