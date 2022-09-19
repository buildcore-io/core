import { AddressTypes, ED25519_ADDRESS_TYPE, INodeInfo } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { last } from 'lodash';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Collection, CollectionStatus, Member, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import { Nft } from '../../../interfaces/models/nft';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { collectionToMetadata, createNftOutput, nftToMetadata } from '../../utils/collection-minting-utils/nft.utils';
import { networks } from '../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { AVAILABLE_NETWORKS } from '../common';
import { cancelNftSale } from './nft.control';

export const mintCollectionOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.mintCollection),
  memory: "8GB",
  timeoutSeconds: 540
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.mintCollection, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const availaibleNetworks = AVAILABLE_NETWORKS.filter(n => networks.includes(n))
  const schema = Joi.object({
    collection: Joi.string().required(),
    network: Joi.string().equal(...availaibleNetworks).required(),
    burnUnsold: Joi.bool().optional(),
  });
  assertValidation(schema.validate(params.body));

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member, params.body.network)
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${params.body.collection}`)

  await admin.firestore().runTransaction(async (transaction) => {
    const collection = <Collection | undefined>(await transaction.get(collectionDocRef)).data()
    if (!collection) {
      throw throwInvalidArgument(WenError.collection_does_not_exists)
    }

    if (collection.status !== CollectionStatus.PRE_MINTED && collection.status !== CollectionStatus.READY_TO_MINT) {
      throw throwInvalidArgument(WenError.invalid_collection_status)
    }

    assertIsGuardian(collection.space, owner)

    transaction.update(collectionDocRef, { status: CollectionStatus.READY_TO_MINT })
  })

  const collection = <Collection>(await collectionDocRef.get()).data()

  const wallet = await WalletService.newWallet(params.body.network) as SmrWallet
  const tmpAddress = await wallet.getNewIotaAddressDetails(false)

  const nftStorageDeposit = await updateNftsAndGetStorageDeposit(collection.uid, params.body.burnUnsold || false, tmpAddress, wallet.info)
  const collectionStorageDeposit = getCollectionStorageDeposit(tmpAddress, collection, wallet.info)

  const targetAddress = await wallet.getNewIotaAddressDetails()
  const order = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: collection.space,
    createdOn: serverTime(),
    network: params.body.network,
    payload: {
      type: TransactionOrderType.MINT_COLLECTION,
      amount: collectionStorageDeposit + nftStorageDeposit,
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      reconciled: false,
      void: false,
      collection: collection.uid,
      collectionStorageDeposit,
      nftStorageDeposit
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
  return order
})


const BATCH_SIZE = 1000

const updateNftsAndGetStorageDeposit = async (collection: string, burnUnsold: boolean, address: AddressDetails, info: INodeInfo) => {
  let storageDeposit = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any = undefined
  do {
    let query = admin.firestore().collection(COL.NFT).where('collection', '==', collection).limit(BATCH_SIZE)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    const snap = await query.get()
    const allNfts = snap.docs.map(d => <Nft>d.data())
    if (burnUnsold) {
      const nftsToBurn = allNfts.filter(nft => !nft.sold)
      const promises = nftsToBurn.map(nft => admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete())
      await Promise.all(promises)
      await admin.firestore().doc(`${COL.COLLECTION}/${collection}`).update({ total: admin.firestore.FieldValue.increment(-nftsToBurn.length) })
    }
    const nftsToMint = burnUnsold ? allNfts.filter(nft => nft.sold) : allNfts
    const cancelSalePromises = nftsToMint.map(nft => cancelNftSale(nft.uid))
    await Promise.all(cancelSalePromises)

    storageDeposit += nftsToMint.map((nft) => {
      const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex }
      const output = createNftOutput(ownerAddress, ownerAddress, JSON.stringify(nftToMetadata(nft)), info)
      return Number(output.amount)
    }).reduce((acc, act) => acc + act, 0)
    lastDoc = last(snap.docs)
  } while (lastDoc !== undefined)

  return storageDeposit
}

const getCollectionStorageDeposit = (address: AddressDetails, collection: Collection, info: INodeInfo) => {
  const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex }
  const output = createNftOutput(ownerAddress, ownerAddress, JSON.stringify(collectionToMetadata(collection)), info)
  return Number(output.amount)
}