import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from "joi";
import { merge } from 'lodash';
import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT, NftAvailableFromDateMin, URL_PATHS } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions/index';
import { TRANSACTION_AUTO_EXPIRY_MS, TRANSACTION_MAX_EXPIRY_MS } from '../../interfaces/models';
import { COL, WenRequest } from '../../interfaces/models/base';
import { Nft, NftAccess } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from "../scale.settings";
import { CommonJoi } from '../services/joi/common';
import { assertMemberHasValidAddress } from '../utils/address.utils';
import { isProdEnv } from '../utils/config.utils';
import { cOn, dateToTimestamp } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { Collection, CollectionType } from './../../interfaces/models/collection';

const defaultJoiUpdateCreateSchema = merge(getDefaultParams(), {
  name: Joi.string().allow(null, '').required(),
  description: Joi.string().allow(null, '').required(),
  collection: CommonJoi.uidCheck(),
  media: Joi.string().allow(null, '').uri({
    scheme: ['https']
  }).optional(),
  // On test we allow now.
  availableFrom: Joi.date().greater(dayjs().add(isProdEnv ? NftAvailableFromDateMin.value : -600000, 'ms').toDate()).required(),
  // Minimum 10Mi price required and max 1Ti
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  url: Joi.string().allow(null, '').uri({
    scheme: ['https', 'http']
  }).optional(),
  // TODO Validate.
  properties: Joi.object().optional(),
  stats: Joi.object().optional()
})

export const createNft = functions.runWith({
  minInstances: scale(WEN_FUNC.cNft),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cNft, context);
  const params = await decodeAuth(req);
  const creator = params.address.toLowerCase();
  const schema = Joi.object(defaultJoiUpdateCreateSchema);
  assertValidation(schema.validate(params.body));

  const collectionDoc = await admin.firestore().doc(`${COL.COLLECTION}/${params.body.collection}`).get();
  if (!collectionDoc.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  const collectionData = <Collection>collectionDoc.data();
  return await processOneCreateNft(creator, params.body, collectionData, collectionData.total + 1);
});

export const createBatchNft = functions.runWith({
  minInstances: scale(WEN_FUNC.cBatchNft),
  timeoutSeconds: 300,
  memory: "4GB",
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cBatchNft, context);

  // Validate auth details before we continue
  const params = await decodeAuth(req);
  const creator = params.address.toLowerCase();
  const schema = Joi.array().items(Joi.object().keys(defaultJoiUpdateCreateSchema)).min(1).max(500);
  assertValidation(schema.validate(params.body));

  // TODO What happens if they submit various collection. We need JOI to only allow same collection within all nfts.
  const refCollection = admin.firestore().collection(COL.COLLECTION).doc(params.body[0].collection);
  const docCollection = await refCollection.get();
  if (!docCollection.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  const collectionData = <Collection>docCollection.data();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promises = params.body.map((b: any, i: number) => processOneCreateNft(creator, b, collectionData, collectionData.total + i + 1))

  return (await Promise.all(promises)).map(n => n.uid)
});

const processOneCreateNft = async (creator: string, params: Nft, collectionData: Collection, position: number) => {
  const nftAddress = getRandomEthAddress();
  const docMember = await admin.firestore().collection(COL.MEMBER).doc(creator).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (collectionData.createdBy !== creator) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (params.availableFrom) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params.availableFrom = dateToTimestamp(<any>params.availableFrom, true);
  }

  if (!collectionData.availableFrom || dayjs(collectionData.availableFrom.toDate()).isAfter(dayjs(params.availableFrom?.toDate()), 'minutes')) {
    throw throwInvalidArgument(WenError.nft_date_must_be_after_or_same_with_collection_available_from_date);
  }

  if (collectionData.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  if (collectionData.approved === true && collectionData.limitedEdition) {
    throw throwInvalidArgument(WenError.this_is_limited_addition_collection);
  }

  if (collectionData.type === CollectionType.GENERATED || collectionData.type === CollectionType.SFT) {
    params.price = collectionData.price || 0;
    params.availableFrom = collectionData.availableFrom || collectionData.createdOn;
  }

  const refNft = admin.firestore().collection(COL.NFT).doc(nftAddress);
  const finalPrice = params.price;
  const docNft = await refNft.get();
  if (!docNft.exists) {
    await refNft.set(keywords(cOn(merge(cleanParams(params), {
      uid: nftAddress,
      locked: false,
      price: (isNaN(finalPrice) || finalPrice < MIN_IOTA_AMOUNT) ? MIN_IOTA_AMOUNT : finalPrice,
      availablePrice: (isNaN(finalPrice) || finalPrice < MIN_IOTA_AMOUNT) ? MIN_IOTA_AMOUNT : finalPrice,
      position: position,
      lockedBy: null,
      ipfsMedia: null,
      ipfsMetadata: null,
      sold: false,
      approved: collectionData.approved,
      rejected: collectionData.rejected,
      owner: null,
      soldOn: null,
      ipfsRetries: 0,
      space: collectionData.space,
      type: collectionData.type,
      hidden: (CollectionType.CLASSIC !== collectionData.type),
      createdBy: creator,
      placeholderNft: false
    }), URL_PATHS.NFT)));

    await admin.firestore().doc(`${COL.COLLECTION}/${collectionData.uid}`).update({
      total: admin.firestore.FieldValue.increment(1)
    });

    // Let's validate if collection has pending item to sell.
    if (collectionData.placeholderNft) {
      await admin.firestore().collection(COL.NFT).doc(collectionData.placeholderNft).update({
        sold: false,
        availableFrom: params.availableFrom,
        hidden: false
      });
    }
  }

  return <Nft>(await refNft.get()).data();
}

const makeAvailableForSaleJoi = merge(getDefaultParams(), {
  nft: CommonJoi.uidCheck().required(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  availableFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFloorPrice: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  auctionLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS),
  access: Joi.number().equal(NftAccess.OPEN, NftAccess.MEMBERS),
  accessMembers: Joi.when('access', {
    is: Joi.exist().valid(NftAccess.MEMBERS),
    then: Joi.array().items(Joi.string().length(ethAddressLength).lowercase()).min(1),
  })
})

export const setForSaleNft = functions.runWith({
  minInstances: scale(WEN_FUNC.setForSaleNft),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.setForSaleNft, context);
  // Validate auth details before we continue
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const nft = params.body.nft.toLowerCase();
  const schema = Joi.object(makeAvailableForSaleJoi);
  assertValidation(schema.validate(params.body));

  const docMember = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refNft = admin.firestore().collection(COL.NFT).doc(nft);
  const docNft = await refNft.get();
  if (!docNft.exists) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }
  const nftRecord = <Nft>docNft.data();

  if (nftRecord.placeholderNft) {
    throw throwInvalidArgument(WenError.nft_placeholder_cant_be_updated);
  }

  if (nftRecord.owner !== owner) {
    throw throwInvalidArgument(WenError.you_must_be_the_owner_of_nft);
  }

  assertMemberHasValidAddress(docMember.data()?.validatedAddress)

  if (params.body.availableFrom) {
    params.body.availableFrom = dateToTimestamp(params.body.availableFrom, true);
  }

  if (params.body.auctionFrom) {
    params.body.auctionFrom = dateToTimestamp(params.body.auctionFrom, true);
  }

  // Validate if auction already in progress.
  if (
    params.body.auctionFrom && nftRecord.auctionFrom &&
    dayjs(nftRecord.auctionFrom.toDate()).isBefore(dayjs())
  ) {
    throw throwInvalidArgument(WenError.nft_auction_already_in_progress);
  }

  const update = <Nft>{
    saleAccess: params.body.access || NftAccess.OPEN,
    saleAccessMembers: params.body.accessMembers || []
  };

  if (params.body.auctionFrom) {
    update.auctionFrom = params.body.auctionFrom;
    update.auctionTo = dateToTimestamp(dayjs(params.body.auctionFrom.toDate()).add(parseInt(params.body.auctionLength), 'ms'));
    update.auctionFloorPrice = parseInt(params.body.auctionFloorPrice);
    update.auctionLength = parseInt(params.body.auctionLength);
    update.auctionHighestBid = 0;
    update.auctionHighestBidder = null;
    update.auctionHighestTransaction = null;
  } else {
    update.auctionFrom = null;
    update.auctionTo = null;
    update.auctionFloorPrice = null;
    update.auctionLength = null;
    update.auctionHighestBid = null;
    update.auctionHighestBidder = null;
    update.auctionHighestTransaction = null;
  }

  if (params.body.availableFrom) {
    update.availableFrom = params.body.availableFrom;
    update.availablePrice = parseInt(params.body.price);
  } else {
    update.availableFrom = null;
    update.availablePrice = null;
  }

  await refNft.update(update);

  return <Nft>(await refNft.get()).data();
});
