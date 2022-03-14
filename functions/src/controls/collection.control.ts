import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { TransactionType } from '../../interfaces/models';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { DocumentSnapshotType } from '../../interfaces/models/firebase';
import { scale } from "../scale.settings";
import { cOn, dateToTimestamp, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { BADGE_TO_CREATE_COLLECTION, DISCORD_REGEXP, MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT, NftAvailableFromDateMin, TWITTER_REGEXP, URL_PATHS } from './../../interfaces/config';
import { Categories, Collection, CollectionAccess, CollectionType, SchemaCollection } from './../../interfaces/models/collection';
import { Member } from './../../interfaces/models/member';
import { CommonJoi } from './../services/joi/common';
import { SpaceValidator } from './../services/validators/space';

function defaultJoiUpdateCreateSchema(): SchemaCollection {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').required(),
    description: Joi.string().allow(null, '').required(),
    space: CommonJoi.uidCheck(),
    placeholderUrl: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    bannerUrl: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    // On test we allow now.
    availableFrom: Joi.date().greater(dayjs().add((functions.config()?.environment?.type === 'prod') ? NftAvailableFromDateMin.value : -60000, 'ms').toDate()).required(),
    // Minimum 10Mi price required and max 1Ti
    price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
    category: Joi.number().equal(...Object.keys(Categories)).required(),
    type: Joi.number().equal(CollectionType.CLASSIC, CollectionType.GENERATED, CollectionType.SFT).required(),
    royaltiesFee: Joi.number().min(0).max(1).required(),
    royaltiesSpace: CommonJoi.uidCheck(),
    access: Joi.number().equal(CollectionAccess.OPEN, CollectionAccess.MEMBERS_ONLY, CollectionAccess.GUARDIANS_ONLY, CollectionAccess.MEMBERS_WITH_BADGE, CollectionAccess.MEMBERS_WITH_NFT_FROM_COLLECTION).required(),
    accessAwards: Joi.when('access', {
      is: Joi.exist().valid(CollectionAccess.MEMBERS_WITH_BADGE),
      then: Joi.array().items(Joi.string().length(ethAddressLength).lowercase()).min(1).required(),
    }),
    accessCollections: Joi.when('access', {
      is: Joi.exist().valid(CollectionAccess.MEMBERS_WITH_NFT_FROM_COLLECTION),
      then: Joi.array().items(Joi.string().length(ethAddressLength).lowercase()).min(1).required(),
    }),
    // TODO Validate XP is not the same.
    discounts: Joi.array().items(Joi.object().keys({
      xp: Joi.string().required(),
      amount: Joi.number().min(0.01).max(1).required()
    })).min(0).max(5).optional(),
    onePerMemberOnly: Joi.boolean().required(),
    discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
    url: Joi.string().allow(null, '').uri({
      scheme: ['https', 'http']
    }).optional(),
    twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional()
  });
}

export const createCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.cCollection),
}).https.onCall(async (req: WenRequest, context: any): Promise<Collection> => {
  appCheck(WEN_FUNC.cCollection, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const creator = params.address.toLowerCase();
  const collectionAddress: string = getRandomEthAddress();
  const schema: ObjectSchema<Member> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));

  const docMember: DocumentSnapshotType = await admin.firestore().collection(COL.MEMBER).doc(creator).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  // Validate space exists.
  const refSpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(params.body.space);
  await SpaceValidator.spaceExists(refSpace);
  await SpaceValidator.hasValidAddress(refSpace);

  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(creator).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  // Temporary. They must have special badge.
  if (functions.config()?.environment?.type !== 'emulator') {
    const qry: admin.firestore.QuerySnapshot = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BADGE)
      .where('payload.award', '==', BADGE_TO_CREATE_COLLECTION)
      .where('member', '==', creator).get();
    if (qry.size === 0) {
      throw throwInvalidArgument(WenError.you_dont_have_required_badge);
    }
    // END
  }


  // Validate royalty space exists
  const refSpaceRoyalty: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(params.body.royaltiesSpace);
  await SpaceValidator.spaceExists(refSpaceRoyalty);
  await SpaceValidator.hasValidAddress(refSpaceRoyalty);

  if (params.body.availableFrom) {
    params.body.availableFrom = dateToTimestamp(params.body.availableFrom);
  }

  const refCollection: admin.firestore.DocumentReference = admin.firestore().collection(COL.COLLECTION).doc(collectionAddress);
  let docCollection: admin.firestore.DocumentSnapshot = await refCollection.get();
  if (!docCollection.exists) {
    // We must generate placeholder NFT.
    let placeholderNft: string | undefined;
    if (params.body.type !== CollectionType.CLASSIC) {
      placeholderNft = getRandomEthAddress();
      const nftPlaceholder: admin.firestore.DocumentReference = admin.firestore().collection(COL.NFT).doc(placeholderNft);
      await nftPlaceholder.set(keywords(cOn({
        uid: placeholderNft,
        name: params.body.name,
        description: params.body.description,
        locked: false,
        media: params.body.placeholderUrl || null,
        availableFrom: params.body.availableFrom || null,
        price: params.body.price,
        collection: collectionAddress,
        position: 0,
        lockedBy: null,
        ipfsMedia: null,
        approved: false,
        rejected: false,
        sold: true,
        soldOn: admin.firestore.Timestamp.now(),
        owner: null,
        space: params.body.space,
        type: params.body.type,
        hidden: true,
        placeholderNft: true,
        createdBy: creator
      }, URL_PATHS.NFT)));
    }

    // Document does not exists.
    await refCollection.set(keywords(cOn(merge(cleanParams(params.body), {
      uid: collectionAddress,
      total: 0,
      sold: 0,
      createdBy: creator,
      approved: false,
      rejected: false,
      placeholderNft: placeholderNft || null
    }), URL_PATHS.NFT)));

    // Load latest
    docCollection = await refCollection.get();
  }

  // Return Collection.
  return <Collection>docCollection.data();
});

export const updateCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.uCollection),
}).https.onCall(async (req: WenRequest, context: any): Promise<Collection> => {
  appCheck(WEN_FUNC.cCollection, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const member = params.address.toLowerCase();
  // Disallow change on below.
  const defaultSchema: SchemaCollection = defaultJoiUpdateCreateSchema();
  delete defaultSchema.type;
  delete defaultSchema.space;
  delete defaultSchema.price;
  delete defaultSchema.access;
  delete defaultSchema.accessAwards;
  delete defaultSchema.accessCollections;
  delete defaultSchema.availableFrom;
  delete defaultSchema.category;
  delete defaultSchema.onePerMemberOnly;
  const schema: ObjectSchema<Collection> = Joi.object(merge(defaultSchema, {
    uid: CommonJoi.uidCheck()
  }));
  assertValidation(schema.validate(params.body));

  const docMember: DocumentSnapshotType = await admin.firestore().collection(COL.MEMBER).doc(member).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (params.body.availableFrom) {
    params.body.availableFrom = dateToTimestamp(params.body.availableFrom);
  }

  const refCollection: admin.firestore.DocumentReference = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
  let docCollection: DocumentSnapshotType = await refCollection.get();
  if (!docCollection.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (docCollection.data().createdBy !== member) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  // Validate space exists.
  const refSpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(docCollection.data().space);
  await SpaceValidator.isGuardian(refSpace, member);

  await admin.firestore().collection(COL.COLLECTION).doc(params.body.uid).update(keywords(uOn(pSchema(
    schema,
    params.body
  ))));

  if (docCollection.data().placeholderNft) {
    const nftPlaceholder: admin.firestore.DocumentReference = admin.firestore().collection(COL.NFT).doc(docCollection.data().placeholderNft);
    await nftPlaceholder.update(keywords(uOn({
      name: params.body.name,
      description: params.body.description,
      media: params.body.placeholderUrl,
      space: docCollection.data().space,
      type: docCollection.data().type
    })));
  }

  // Load latest
  docCollection = await refCollection.get();

  // Return Collection.
  return <Collection>docCollection.data();
});


export const approveCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.approveCollection),
}).https.onCall(async (req: WenRequest, context: any): Promise<Collection> => {
  appCheck(WEN_FUNC.approveCollection, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const member = params.address.toLowerCase();
  const schema: ObjectSchema<Collection> = Joi.object({
    uid: CommonJoi.uidCheck()
  });
  assertValidation(schema.validate(params.body));

  const docMember: DocumentSnapshotType = await admin.firestore().collection(COL.MEMBER).doc(member).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refCollection: admin.firestore.DocumentReference = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
  let docCollection: DocumentSnapshotType = await refCollection.get();
  if (!docCollection.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (docCollection.data().approved) {
    throw throwInvalidArgument(WenError.collection_is_already_approved);
  }

  if (docCollection.data().rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  // Validate space exists.
  const refSpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(docCollection.data().space);
  await SpaceValidator.spaceExists(refSpace);
  await SpaceValidator.isGuardian(refSpace, member);

  // Document does not exists.
  await admin.firestore().collection(COL.COLLECTION).doc(params.body.uid).update({
    approved: true
  });

  // Load latest
  docCollection = await refCollection.get();

  // Return Collection.
  return <Collection>docCollection.data();
});


export const rejectCollection: functions.CloudFunction<Collection> = functions.runWith({
  minInstances: scale(WEN_FUNC.rejectCollection),
}).https.onCall(async (req: WenRequest, context: any): Promise<Collection> => {
  appCheck(WEN_FUNC.rejectCollection, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const member = params.address.toLowerCase();
  const schema: ObjectSchema<Collection> = Joi.object({
    uid: CommonJoi.uidCheck()
  });
  assertValidation(schema.validate(params.body));

  const docMember: admin.firestore.DocumentSnapshot = await admin.firestore().collection(COL.MEMBER).doc(member).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refCollection: admin.firestore.DocumentReference = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
  let docCollection: DocumentSnapshotType = await refCollection.get();
  if (!docCollection.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (!docCollection.data().availableFrom || dayjs(docCollection.data().availableFrom.toDate()).isBefore(dayjs())) {
    throw throwInvalidArgument(WenError.collection_is_past_available_date);
  }

  if (docCollection.data().rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  // Validate space exists.
  const refSpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(docCollection.data().space);
  await SpaceValidator.spaceExists(refSpace);
  await SpaceValidator.isGuardian(refSpace, member);


  // Document does not exists.
  await admin.firestore().collection(COL.COLLECTION).doc(params.body.uid).update({
    rejected: true
  });

  // Load latest
  docCollection = await refCollection.get();

  // Return Collection.
  return <Collection>docCollection.data();
});
