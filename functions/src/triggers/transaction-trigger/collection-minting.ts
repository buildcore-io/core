import { TransactionHelper } from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";
import { isEmpty, last } from "lodash";
import { CollectionStatus, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Nft, NftStatus } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { SmrWallet } from "../../services/wallet/SmrWalletService";
import { WalletService } from "../../services/wallet/wallet";
import { createNftOutput, nftToMetadata } from "../../utils/collection-minting-utils/nft.utils";
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";

const NFT_MINT_BATCH_SIZE = 100

export const createNftMintingOrdersForCollection = async (transaction: Transaction) => {
  const wallet = await WalletService.newWallet(transaction.network) as SmrWallet
  const tmp = await wallet.getNewIotaAddressDetails(false)
  const info = await wallet.client.info()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any = undefined
  let nftsToMint = 0
  do {
    let query = admin.firestore().collection(COL.NFT)
      .where('collection', '==', transaction.payload.collection)
      .limit(NFT_MINT_BATCH_SIZE)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    const snap = await query.get()

    if (isEmpty(snap.docs)) {
      break;
    }

    const nfts = snap.docs.map(d => d.id)
    nftsToMint += nfts.length

    const totalStorageDeposit = snap.docs.reduce((sum, doc) => {
      const output = createNftOutput(tmp, undefined, JSON.stringify(nftToMetadata(<Nft>doc.data())), info)
      return sum + Number(output.amount)
    }, 0)

    const order = <Transaction>{
      type: TransactionType.MINT_NFTS,
      uid: getRandomEthAddress(),
      member: transaction.member,
      space: transaction.space,
      createdOn: serverTime(),
      network: transaction.network,
      payload: {
        amount: totalStorageDeposit,
        sourceAddress: transaction.payload.sourceAddress,
        collection: transaction.payload.collection,
        nfts
      }
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)

    lastDoc = last(snap.docs)
  } while (lastDoc !== undefined)

  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.mintedBy': transaction.member,
    'mintingData.mintedOn': serverTime(),
    'mintingData.nftsToMint': admin.firestore.FieldValue.increment(nftsToMint),
    'mintingData.address': transaction.payload.sourceAddress,
    'mintingData.blockId': milestoneTransaction.blockId,
  })
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
