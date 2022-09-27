import { AddressTypes, ED25519_ADDRESS_TYPE, INodeInfo } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { last } from 'lodash';
import { MAX_IOTA_AMOUNT } from '../../../interfaces/config';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Collection, CollectionStatus, CollectionType, Member, Space, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import { UnsoldMintingOptions } from '../../../interfaces/models/collection';
import { Nft } from '../../../interfaces/models/nft';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress, assertSpaceHasValidAddress } from '../../utils/address.utils';
import { collectionToMetadata, createNftOutput, EMPTY_NFT_ID, nftToMetadata } from '../../utils/collection-minting-utils/nft.utils';
import { isProdEnv, networks } from '../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { AVAILABLE_NETWORKS } from '../common';

const availaibleNetworks = AVAILABLE_NETWORKS.filter(n => networks.includes(n))
const schema = Joi.object({
  collection: Joi.string().required(),
  network: Joi.string().equal(...availaibleNetworks).required(),
  unsoldMintingOptions: Joi.string().equal(...Object.values(UnsoldMintingOptions)).required(),
  price: Joi.when('unsoldMintingOptions', {
    is: Joi.exist().valid(UnsoldMintingOptions.SET_NEW_PRICE),
    then: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required()
  }),
})

export const mintCollectionOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.mintCollection),
  memory: "8GB",
  timeoutSeconds: 540
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.mintCollection, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  assertValidation(schema.validate(params.body));
  const network = params.body.network

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member, network)
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${params.body.collection}`)

  return await admin.firestore().runTransaction(async (transaction) => {
    const collection = <Collection | undefined>(await transaction.get(collectionDocRef)).data()

    if (!collection) {
      throw throwInvalidArgument(WenError.collection_does_not_exists)
    }

    if (isProdEnv() && !collection.approved) {
      throw throwInvalidArgument(WenError.collection_must_be_approved)
    }

    if (collection.status !== CollectionStatus.PRE_MINTED) {
      throw throwInvalidArgument(WenError.invalid_collection_status)
    }

    if (params.body.unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE &&
      ![CollectionType.GENERATED, CollectionType.SFT].includes(collection.type)) {
      throw throwInvalidArgument(WenError.invalid_collection_status)
    }

    if (params.body.unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP && collection.type !== CollectionType.CLASSIC) {
      throw throwInvalidArgument(WenError.invalid_collection_status)
    }

    assertIsGuardian(collection.space, owner)

    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${collection.space}`).get()).data()
    assertSpaceHasValidAddress(space, network)

    const royaltySpace = <Space>(await admin.firestore().doc(`${COL.SPACE}/${collection.royaltiesSpace}`).get()).data()
    assertSpaceHasValidAddress(royaltySpace, network)

    const wallet = await WalletService.newWallet(network) as SmrWallet
    const targetAddress = await wallet.getNewIotaAddressDetails()

    const nftsStorageDeposit = await getNftsTotalStorageDeposit(collection, params.body.unsoldMintingOptions, targetAddress, wallet.info)
    if (!nftsStorageDeposit) {
      throw throwInvalidArgument(WenError.no_nfts_to_mint)
    }
    const collectionStorageDeposit = await getCollectionStorageDeposit(targetAddress, collection, wallet.info)
    const aliasStorageDeposit = Number(createAliasOutput(targetAddress, wallet.info).amount)

    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: collection.space,
      createdOn: serverTime(),
      network,
      payload: {
        type: TransactionOrderType.MINT_COLLECTION,
        amount: collectionStorageDeposit + nftsStorageDeposit + aliasStorageDeposit,
        targetAddress: targetAddress.bech32,
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
        reconciled: false,
        void: false,
        collection: collection.uid,
        unsoldMintingOptions: params.body.unsoldMintingOptions,
        newPrice: Number(params.body.price || 0),
        collectionStorageDeposit,
        nftsStorageDeposit,
        aliasStorageDeposit
      }
    }
    transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`), order)
    return order
  })
})

const BATCH_SIZE = 1000
const getNftsTotalStorageDeposit = async (
  collection: Collection,
  unsoldMintingOptions: UnsoldMintingOptions,
  address: AddressDetails,
  info: INodeInfo
) => {
  const storage = admin.storage()
  let storageDeposit = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any = undefined
  do {
    let query = admin.firestore().collection(COL.NFT)
      .where('collection', '==', collection.uid)
      .where('placeholderNft', '==', false)
      .limit(BATCH_SIZE)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    const snap = await query.get()
    const nfts = snap.docs.map(d => <Nft>d.data())
      .filter(nft => (nft.approved || !isProdEnv()) && (unsoldMintingOptions !== UnsoldMintingOptions.BURN_UNSOLD || nft.sold))

    const promises = nfts.map(async (nft) => {
      const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex }
      const metadata = JSON.stringify(await nftToMetadata(storage, nft, collection, address.bech32, EMPTY_NFT_ID))
      const output = createNftOutput(ownerAddress, ownerAddress, metadata, info)
      return Number(output.amount)
    })
    storageDeposit += (await Promise.all(promises)).reduce((acc, act) => acc + act, 0)

    lastDoc = last(snap.docs)
  } while (lastDoc !== undefined)

  return storageDeposit
}

const getCollectionStorageDeposit = async (address: AddressDetails, collection: Collection, info: INodeInfo) => {
  const storage = admin.storage();
  const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex }
  const metadata = await collectionToMetadata(storage, collection, address.bech32)
  const output = createNftOutput(ownerAddress, ownerAddress, JSON.stringify(metadata), info)
  return Number(output.amount)
}
