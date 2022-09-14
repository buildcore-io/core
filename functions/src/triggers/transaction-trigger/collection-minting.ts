import { TransactionHelper } from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";
import { CollectionStatus, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Nft, NftStatus } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";

const NFT_MINT_BATCH_SIZE = 100

export const createNftMintingOrdersForCollection = async (transaction: Transaction) => {
  const nfts = (await admin.firestore().collection(COL.NFT).where('collection', '==', transaction.payload.collection).get())
    .docs.map(doc => <Nft>doc.data())

  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.mintedBy': transaction.member,
    'mintingData.mintedOn': serverTime(),
    'mintingData.nftsToMint': nfts.length,
    'mintingData.address': transaction.payload.sourceAddress,
    'mintingData.blockId': milestoneTransaction.blockId,
  })

  const createNftMintTran = () => <Transaction>{
    type: TransactionType.MINT_NFTS,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    createdOn: serverTime(),
    network: transaction.network,
    payload: {
      sourceAddress: transaction.payload.sourceAddress,
      collection: transaction.payload.collection,
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

export const onNftMintSuccess = async (transaction: Transaction) => {
  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.nftsToMint': admin.firestore.FieldValue.increment(-transaction.payload.nfts.length)
  })
  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  const promises = (transaction.payload.nfts as string[]).map((nftId, i) => {
    const outputId = Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(milestoneTransaction.payload), true) + indexToString(i + 1);
    return admin.firestore().doc(`${COL.NFT}/${nftId}`).update({
      'mintingData.mintedOn': serverTime(),
      'mintingData.mintedBy': transaction.member,
      'mintingData.blockId': milestoneTransaction.blockId,
      'mintingData.nftId': TransactionHelper.resolveIdFromOutputId(outputId),
      status: NftStatus.MINTED
    })
  }
  )
  await Promise.all(promises)
}

export const onCollectionNftTransferedToGuardian = async (transaction: Transaction) => {
  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  const nftId = milestoneTransaction.payload.essence.outputs[0].nftId
  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.address': '',
    'mintingData.nftId': nftId,
    status: CollectionStatus.MINTED
  })
}

const indexToString = (index: number) => {
  let str = `0${index}`
  while (str.length < 4) {
    str = str + '0'
  }
  return str
}
