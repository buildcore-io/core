import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { TransactionType } from '../../interfaces/models';
import { Access, COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { NftStatus } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from "../scale.settings";
import { isEmulatorEnv, isProdEnv } from '../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { assertValidation, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { BADGE_TO_CREATE_COLLECTION, DISCORD_REGEXP, MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT, NftAvailableFromDateMin, TWITTER_REGEXP, URL_PATHS } from './../../interfaces/config';
import { Categories, Collection, CollectionStatus, CollectionType } from './../../interfaces/models/collection';
import { CommonJoi } from './../services/joi/common';
import { SpaceValidator } from './../services/validators/space';

const updateCollectionSchema = {
  name: Joi.string().allow(null, '').required(),
  description: Joi.string().allow(null, '').required(),
  placeholderUrl: Joi.string().allow(null, '').uri({
    scheme: ['https']
  }).optional(),
  bannerUrl: Joi.string().allow(null, '').uri({
    scheme: ['https']
  }).optional(),
  royaltiesFee: Joi.number().min(0).max(1).required(),
  royaltiesSpace: CommonJoi.uidCheck(),
  // TODO Validate XP is not the same.
  discounts: Joi.array().items(Joi.object().keys({
    xp: Joi.string().required(),
    amount: Joi.number().min(0.01).max(1).required()
  })).min(0).max(5).optional(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  url: Joi.string().allow(null, '').uri({
    scheme: ['https', 'http']
  }).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional()
}

const createCollectionSchema = {
  ...updateCollectionSchema,
  type: Joi.number().equal(CollectionType.CLASSIC, CollectionType.GENERATED, CollectionType.SFT).required(),
  space: CommonJoi.uidCheck(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  access: Joi.number().equal(...Object.values(Access)).required(),
  accessAwards: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_BADGE),
    then: Joi.array().items(Joi.string().length(ethAddressLength).lowercase()).min(1).required(),
  }),
  accessCollections: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_NFT_FROM_COLLECTION),
    then: Joi.array().items(Joi.string().length(ethAddressLength).lowercase()).min(1).required(),
  }),
  // On test we allow now.
  availableFrom: Joi.date().greater(dayjs().add(isProdEnv() ? NftAvailableFromDateMin.value : -600000, 'ms').toDate()).required(),
  category: Joi.number().equal(...Object.keys(Categories)).required(),
  onePerMemberOnly: Joi.boolean().required(),
  limitedEdition: Joi.boolean().optional()
}

export const createCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.cCollection),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
  appCheck(WEN_FUNC.cCollection, context);
  const params = await decodeAuth(req);
  const creator = params.address.toLowerCase();
  const schema = Joi.object(createCollectionSchema);
  assertValidation(schema.validate(params.body));

  const docMember = await admin.firestore().collection(COL.MEMBER).doc(creator).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const spaceDocRef = admin.firestore().collection(COL.SPACE).doc(params.body.space);
  await SpaceValidator.spaceExists(spaceDocRef);
  await SpaceValidator.hasValidAddress(spaceDocRef);

  if (!(await spaceDocRef.collection(SUB_COL.MEMBERS).doc(creator).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  // Temporary. They must have special badge.
  if (!isEmulatorEnv) {
    const qry: admin.firestore.QuerySnapshot = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BADGE)
      .where('payload.award', 'in', BADGE_TO_CREATE_COLLECTION)
      .where('member', '==', creator).get();
    if (qry.size === 0) {
      throw throwInvalidArgument(WenError.you_dont_have_required_badge);
    }
  }

  const royaltySpaceDocRef = admin.firestore().collection(COL.SPACE).doc(params.body.royaltiesSpace);
  await SpaceValidator.spaceExists(royaltySpaceDocRef);
  await SpaceValidator.hasValidAddress(royaltySpaceDocRef);

  if (params.body.availableFrom) {
    params.body.availableFrom = dateToTimestamp(params.body.availableFrom, true);
  }

  const collectionId = getRandomEthAddress();
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collectionId}`)
  const placeholderNftId = params.body.type !== CollectionType.CLASSIC ? getRandomEthAddress() : null
  if (placeholderNftId) {
    await admin.firestore().doc(`${COL.NFT}/${placeholderNftId}`).set((cOn({
      uid: placeholderNftId,
      name: params.body.name,
      description: params.body.description,
      locked: false,
      media: params.body.placeholderUrl || null,
      availableFrom: params.body.availableFrom || null,
      price: params.body.price,
      collection: collectionId,
      position: 0,
      lockedBy: null,
      ipfsMedia: null,
      approved: false,
      rejected: false,
      sold: true,
      soldOn: serverTime(),
      owner: null,
      space: params.body.space,
      type: params.body.type,
      hidden: true,
      placeholderNft: true,
      createdBy: creator,
      status: NftStatus.PRE_MINTED
    }, URL_PATHS.NFT)));
  }

  await collectionDocRef.set((cOn(merge(cleanParams(params.body), {
    uid: collectionId,
    total: 0,
    sold: 0,
    createdBy: creator,
    approved: false,
    rejected: false,
    limitedEdition: !!params.body.limitedEdition,
    placeholderNft: placeholderNftId || null,
    status: CollectionStatus.PRE_MINTED
  }), URL_PATHS.COLLECTION)));

  return <Collection>(await collectionDocRef.get()).data();
});

export const updateCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.uCollection),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
  appCheck(WEN_FUNC.cCollection, context);
  const params: DecodedToken = await decodeAuth(req);
  const member = params.address.toLowerCase();
  const schema = Joi.object({ ...updateCollectionSchema, uid: CommonJoi.uidCheck() });
  assertValidation(schema.validate(params.body));

  const memberDocRef = await admin.firestore().collection(COL.MEMBER).doc(member).get();
  if (!memberDocRef.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (params.body.availableFrom) {
    params.body.availableFrom = dateToTimestamp(params.body.availableFrom, true);
  }

  const collectionDocRef = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
  const collection = <Collection | undefined>(await collectionDocRef.get()).data();
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (collection.status !== CollectionStatus.PRE_MINTED) {
    throw throwInvalidArgument(WenError.invalid_collection_status)
  }

  if (collection.createdBy !== member) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (collection.royaltiesFee < params.body.royaltiesFee) {
    throw throwInvalidArgument(WenError.royalty_fees_can_only_be_reduced);
  }

  const spaceDocRef = admin.firestore().collection(COL.SPACE).doc(collection.space);
  await SpaceValidator.isGuardian(spaceDocRef, member);

  await collectionDocRef.update((uOn(pSchema(schema, params.body))));

  if (collection.placeholderNft) {
    const nftPlaceholder = admin.firestore().collection(COL.NFT).doc(collection.placeholderNft);
    await nftPlaceholder.update((uOn({
      name: params.body.name,
      description: params.body.description,
      media: params.body.placeholderUrl,
      space: collection.space,
      type: collection.type
    })));
  }

  return <Collection>(await collectionDocRef.get()).data();
});

export const approveCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.approveCollection),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
  appCheck(WEN_FUNC.approveCollection, context);
  const params: DecodedToken = await decodeAuth(req);
  const member = params.address.toLowerCase();
  const schema = Joi.object({ uid: CommonJoi.uidCheck() });
  assertValidation(schema.validate(params.body));

  const memberDocRef = await admin.firestore().collection(COL.MEMBER).doc(member).get();
  if (!memberDocRef.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const collectionDocRef = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
  const collection = <Collection | undefined>(await collectionDocRef.get()).data()
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (collection.approved) {
    throw throwInvalidArgument(WenError.collection_is_already_approved);
  }

  if (collection.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  const spaceDocRef = admin.firestore().collection(COL.SPACE).doc(collection.space);
  await SpaceValidator.spaceExists(spaceDocRef);
  await SpaceValidator.isGuardian(spaceDocRef, member);

  await collectionDocRef.update({ approved: true });

  return <Collection>(await collectionDocRef.get()).data();
});

export const rejectCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.rejectCollection),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
  appCheck(WEN_FUNC.rejectCollection, context);
  const params: DecodedToken = await decodeAuth(req);
  const member = params.address.toLowerCase();
  const schema = Joi.object({ uid: CommonJoi.uidCheck() });
  assertValidation(schema.validate(params.body));

  const memberDocRef = await admin.firestore().collection(COL.MEMBER).doc(member).get();
  if (!memberDocRef.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const collectionDocRef = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
  const collection = <Collection | undefined>(await collectionDocRef.get()).data();
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (!collection.availableFrom || dayjs(collection.availableFrom.toDate()).isBefore(dayjs())) {
    throw throwInvalidArgument(WenError.collection_is_past_available_date);
  }

  if (collection.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  const refSpace = admin.firestore().collection(COL.SPACE).doc(collection.space);
  await SpaceValidator.spaceExists(refSpace);
  await SpaceValidator.isGuardian(refSpace, member);

  await collectionDocRef.update({ approved: false, rejected: true });

  return <Collection>(await collectionDocRef.get()).data();
});
