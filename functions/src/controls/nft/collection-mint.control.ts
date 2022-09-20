import { AddressTypes, ED25519_ADDRESS_TYPE, INodeInfo } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { last } from 'lodash';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Collection, CollectionStatus, Member, Space, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import { Nft } from '../../../interfaces/models/nft';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress, assertSpaceHasValidAddress } from '../../utils/address.utils';
import { collectionToMetadata, createNftOutput, EMPTY_NFT_ID, nftToMetadata } from '../../utils/collection-minting-utils/nft.utils';
import { networks } from '../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
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
  const network = params.body.network

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member, network)
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

    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${collection.space}`).get()).data()
    assertSpaceHasValidAddress(space, network)

    const royaltySpace = <Space>(await admin.firestore().doc(`${COL.SPACE}/${collection.royaltiesSpace}`).get()).data()
    assertSpaceHasValidAddress(royaltySpace, network)

    transaction.update(collectionDocRef, { status: CollectionStatus.READY_TO_MINT })
  })

  const collection = <Collection>(await collectionDocRef.get()).data()

  const wallet = await WalletService.newWallet(network) as SmrWallet
  const tmpAddress = await wallet.getNewIotaAddressDetails(false)

  const nftStorageDeposit = await updateNftsAndGetStorageDeposit(collection, params.body.burnUnsold || false, tmpAddress, wallet.info)
  const collectionStorageDeposit = getCollectionStorageDeposit(tmpAddress, collection, wallet.info)
  const aliasStorageDeposit = Number(createAliasOutput(tmpAddress, wallet.info).amount)

  const targetAddress = await wallet.getNewIotaAddressDetails()
  const order = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: collection.space,
    createdOn: serverTime(),
    network,
    payload: {
      type: TransactionOrderType.MINT_COLLECTION,
      amount: collectionStorageDeposit + nftStorageDeposit + aliasStorageDeposit,
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      reconciled: false,
      void: false,
      collection: collection.uid,
      collectionStorageDeposit,
      nftStorageDeposit,
      aliasStorageDeposit
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
  return order
})


const BATCH_SIZE = 1000

const updateNftsAndGetStorageDeposit = async (collection: Collection, burnUnsold: boolean, address: AddressDetails, info: INodeInfo) => {
  let storageDeposit = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any = undefined
  do {
    let query = admin.firestore().collection(COL.NFT).where('collection', '==', collection.uid).limit(BATCH_SIZE)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    const snap = await query.get()
    const allNfts = snap.docs.map(d => <Nft>d.data())
    if (burnUnsold) {
      const nftsToBurn = allNfts.filter(nft => !nft.sold)
      const promises = nftsToBurn.map(nft => admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete())
      await Promise.all(promises)
      await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).update({ total: admin.firestore.FieldValue.increment(-nftsToBurn.length) })
    }
    const nftsToMint = burnUnsold ? allNfts.filter(nft => nft.sold) : allNfts
    const cancelSalePromises = nftsToMint.map(nft => cancelNftSale(nft.uid))
    await Promise.all(cancelSalePromises)

    storageDeposit += nftsToMint.map((nft) => {
      const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex }
      const output = createNftOutput(ownerAddress, ownerAddress, JSON.stringify(nftToMetadata(nft, collection, address.bech32, EMPTY_NFT_ID)), info)
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
