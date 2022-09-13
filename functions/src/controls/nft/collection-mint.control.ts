import { INftOutput } from '@iota/iota.js-next';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Collection, CollectionStatus, Member, Network, Transaction, TransactionOrderType, TransactionType, TransactionValidationType } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import { Nft } from '../../../interfaces/models/nft';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { collectionToMetadata, createNftOutput, nftToMetadata } from '../../utils/collection-minting-utils/nft.utils';
import { networks } from '../../utils/config.utils';
import { serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { AVAILABLE_NETWORKS } from '../common';
import { cancelNftSale } from './nft.control';

export const mintCollectionOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.mintCollection),
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
  const nftSnap = (await admin.firestore().collection(COL.NFT)
    .where('collection', '==', params.body.collection)
    .get()
  )
  const allNfts = nftSnap.docs.map(d => <Nft>d.data())
  if (params.body.burnUnsold) {
    const promises = allNfts.filter(nft => !nft.sold).map(nft => admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete())
    await Promise.allSettled(promises)
  }

  const nftsToMint = params.body.burnUnsold ? allNfts.filter(nft => nft.sold) : allNfts

  const cancelSalePromises = nftsToMint.map(nft => cancelNftSale(nft.uid))
  await Promise.all(cancelSalePromises)

  const wallet = await WalletService.newWallet(params.body.network) as SmrWallet
  const info = await wallet.client.info()
  const nftOutputs: INftOutput[] = []
  for (const nft of nftsToMint) {
    const tmpAddress = await wallet.getNewIotaAddressDetails()
    nftOutputs.push(createNftOutput(tmpAddress, undefined, JSON.stringify(nftToMetadata(nft)), info))
  }

  const collectionTmpAddress = await wallet.getNewIotaAddressDetails()
  const collectionOutput = createNftOutput(collectionTmpAddress, undefined, JSON.stringify(collectionToMetadata(collection)), info)

  const totalStorageDeposit = nftOutputs.reduce((acc, act) => acc + Number(act.amount), Number(collectionOutput.amount))

  const targetAddress = await wallet.getNewIotaAddressDetails()
  const order = createCollectionMintOrder(params.body.collection, owner, collection.space, params.body.network, totalStorageDeposit, targetAddress.bech32)
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
  return order
})

const createCollectionMintOrder = (
  collection: string,
  member: string,
  space: string,
  network: Network,
  amount: number,
  targetAddress: string
) => <Transaction>{
  type: TransactionType.ORDER,
  uid: getRandomEthAddress(),
  member,
  space,
  createdOn: serverTime(),
  network,
  payload: {
    type: TransactionOrderType.MINT_COLLECTION,
    amount,
    targetAddress,
    validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
    reconciled: false,
    void: false,
    collection
  }
}