import { BASIC_OUTPUT_TYPE, IBasicOutput, INftOutput, NFT_OUTPUT_TYPE, OutputTypes, TransactionHelper } from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";
import { isEmpty, last } from "lodash";
import { CollectionStatus, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Nft, NftStatus } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { MintNftInputParams, NftWallet } from "../../services/wallet/NftWallet";
import { SmrWallet } from "../../services/wallet/SmrWalletService";
import { AddressDetails, WalletService } from "../../services/wallet/wallet";
import { packBasicOutput } from "../../utils/basic-output.utils";
import { isValidBlockSize } from "../../utils/block.utils";
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";
import { getWalletParams } from "./wallet-params";

const NFT_MINT_BATCH_SIZE = 100

export const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!
  const collectionOutputId = Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(milestoneTransaction.payload), true) + "0100"
  const collectionOutput = <INftOutput>(milestoneTransaction.payload.essence.outputs as OutputTypes[]).find(o => o.type === NFT_OUTPUT_TYPE)
  const consumedOutput = <IBasicOutput | undefined>(milestoneTransaction.payload.essence.outputs as OutputTypes[]).find(o => o.type === BASIC_OUTPUT_TYPE)
  if (!consumedOutput) {
    await saveCollectionMintingData(transaction, milestoneTransaction.blockId, collectionOutputId, 0)
    return
  }
  const consumedOutputId = Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(milestoneTransaction.payload), true) + "0200"
  const inputParams: MintNftInputParams = { collectionOutputId, collectionOutput, consumedOutputId, consumedOutput }
  const nftsToMint = await createNftMintingOrders(transaction, inputParams)
  await saveCollectionMintingData(transaction, milestoneTransaction.blockId, collectionOutputId, nftsToMint)
}

const saveCollectionMintingData = (transaction: Transaction, blockId: string, collectionOutputId: string, nftsToMint: number) =>
  admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.blockId': blockId,
    'mintingData.storageDeposit': transaction.payload.amount,
    'mintingData.nftId': TransactionHelper.resolveIdFromOutputId(collectionOutputId),
    'mintingData.nftsToMint': admin.firestore.FieldValue.increment(nftsToMint),
    'mintingData.mintedBy': transaction.member,
    'mintingData.mintedOn': serverTime(),
    'mintingData.address': transaction.payload.sourceAddress
  })

const createNftMintingOrders = async (transaction: Transaction, inputPramas: MintNftInputParams) => {
  const wallet = await WalletService.newWallet(transaction.network) as SmrWallet
  const tmpAddress = await wallet.getNewIotaAddressDetails(false)
  const parents = (await wallet.client.tips()).tips;
  const params = await getWalletParams(transaction, transaction.network!)
  const nftWallet = new NftWallet(wallet)

  let nftsToMint = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any = undefined
  const collectionNftId = TransactionHelper.resolveIdFromOutputId(inputPramas.collectionOutputId)

  do {
    let query = admin.firestore().collection(COL.NFT)
      .where('collection', '==', transaction.payload.collection)
      .limit(NFT_MINT_BATCH_SIZE)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    const snap = (await query.get())
    const nfts = snap.docs.map(d => <Nft>d.data())

    if (isEmpty(nfts)) {
      break;
    }

    let actNftsToMint = nfts.length
    let totalStorageDeposit = 0
    do {
      const nftOutputs = packNfts(nfts.slice(0, actNftsToMint), nftWallet, tmpAddress, collectionNftId)
      const remainderAmount = nftOutputs.reduce((acc, act) => acc - Number(act.amount), Number(inputPramas.consumedOutput.amount))
      const remainder = packBasicOutput(tmpAddress.bech32, remainderAmount, [], wallet.info)
      const block = nftWallet.packNftMintBlock(tmpAddress, parents, inputPramas, nftOutputs, remainderAmount ? remainder : undefined, params)

      if (isValidBlockSize(block)) {
        totalStorageDeposit = nftOutputs.reduce((acc, act) => acc + Number(act.amount), 0)
        break;
      }

      actNftsToMint--
    } while (actNftsToMint > 0)

    if (!actNftsToMint) {
      throw Error('Nft data to big to mint')
    }

    const nftDocsToMint = snap.docs.slice(0, actNftsToMint)
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
        nfts: nftDocsToMint.map(d => d.id)
      }
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)

    lastDoc = last(nftDocsToMint)
    nftsToMint += actNftsToMint
  } while (lastDoc)
  return nftsToMint
}

const packNfts = (nfts: Nft[], nftWallet: NftWallet, address: AddressDetails, collectionNftId: string) =>
  nfts.map((nft) => nftWallet.packNft(nft, address, collectionNftId))

export const onNftMintSuccess = async (transaction: Transaction) => {
  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.nftsToMint': admin.firestore.FieldValue.increment(-transaction.payload.nfts.length)
  })
  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  const promises = (transaction.payload.nfts as string[]).map((nftId, i) => {
    const outputId = Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(milestoneTransaction.payload), true) + indexToString(i + 1);
    return admin.firestore().doc(`${COL.NFT}/${nftId}`).update({
      'mintingData.network': transaction.network,
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
