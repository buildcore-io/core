import {
  Access,
  Categories,
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  DISCORD_REGEXP,
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  NftAvailableFromDateMin,
  NftStatus,
  SUB_COL,
  TWITTER_REGEXP,
  URL_PATHS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { merge, uniq } from 'lodash';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { hasStakedSoonTokens } from '../services/stake.service';
import { isProdEnv } from '../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';
import { CommonJoi } from './../services/joi/common';
import { SpaceValidator } from './../services/validators/space';

const updateMintedCollectionSchema = {
  discounts: Joi.array()
    .items(
      Joi.object().keys({
        xp: Joi.string().required(),
        amount: Joi.number().min(0.01).max(1).required(),
      }),
    )
    .min(0)
    .max(5)
    .optional()
    .custom((discounts: { xp: string; amount: number }[], helpers) => {
      const unique = uniq(discounts.map((d) => d.xp));
      if (unique.length !== discounts.length) {
        return helpers.error('XP must me unique');
      }
      return discounts;
    }),
  access: Joi.number()
    .equal(...Object.values(Access))
    .optional(),
};

const updateCollectionSchema = {
  ...updateMintedCollectionSchema,
  name: Joi.string().allow(null, '').required(),
  description: Joi.string().allow(null, '').required(),
  placeholderUrl: CommonJoi.storageUrl(false),
  bannerUrl: CommonJoi.storageUrl(false),
  royaltiesFee: Joi.number().min(0).max(1).required(),
  royaltiesSpace: CommonJoi.uid(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  url: Joi.string()
    .allow(null, '')
    .uri({
      scheme: ['https', 'http'],
    })
    .optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
};

const createCollectionSchema = {
  ...updateCollectionSchema,
  type: Joi.number()
    .equal(CollectionType.CLASSIC, CollectionType.GENERATED, CollectionType.SFT)
    .required(),
  space: CommonJoi.uid(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  access: Joi.number()
    .equal(...Object.values(Access))
    .required(),
  accessAwards: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_BADGE),
    then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
  }),
  accessCollections: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_NFT_FROM_COLLECTION),
    then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
  }),
  // On test we allow now.
  availableFrom: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? NftAvailableFromDateMin.value : -600000, 'ms')
        .toDate(),
    )
    .required(),
  category: Joi.number()
    .equal(...Object.keys(Categories))
    .required(),
  onePerMemberOnly: Joi.boolean().required(),
  limitedEdition: Joi.boolean().optional(),
};

export const createCollection: functions.CloudFunction<Collection> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cCollection),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
      appCheck(WEN_FUNC.cCollection, context);
      const params = await decodeAuth(req, WEN_FUNC.cCollection);
      const owner = params.address.toLowerCase();
      const schema = Joi.object(createCollectionSchema);
      await assertValidationAsync(schema, params.body);

      const hasStakedSoons = await hasStakedSoonTokens(owner);
      if (!hasStakedSoons) {
        throw throwInvalidArgument(WenError.no_staked_soon);
      }

      const spaceDocRef = admin.firestore().collection(COL.SPACE).doc(params.body.space);
      await SpaceValidator.spaceExists(spaceDocRef);
      await SpaceValidator.hasValidAddress(spaceDocRef);

      const spaceMemberDoc = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
      if (!spaceMemberDoc.exists) {
        throw throwInvalidArgument(WenError.you_are_not_part_of_space);
      }

      const royaltySpaceDocRef = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.royaltiesSpace);
      await SpaceValidator.spaceExists(royaltySpaceDocRef);
      await SpaceValidator.hasValidAddress(royaltySpaceDocRef);

      if (params.body.availableFrom) {
        params.body.availableFrom = dateToTimestamp(params.body.availableFrom, true);
      }

      const collectionId = getRandomEthAddress();
      const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collectionId}`);
      const placeholderNftId =
        params.body.type !== CollectionType.CLASSIC ? getRandomEthAddress() : null;
      if (placeholderNftId) {
        await admin
          .firestore()
          .doc(`${COL.NFT}/${placeholderNftId}`)
          .set(
            cOn(
              {
                uid: placeholderNftId,
                name: params.body.name,
                description: params.body.description,
                locked: false,
                media: params.body.placeholderUrl || null,
                availableFrom: params.body.availableFrom || null,
                price: params.body.price,
                availablePrice: params.body.price,
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
                createdBy: owner,
                status: NftStatus.PRE_MINTED,
              },
              URL_PATHS.NFT,
            ),
          );
      }

      await collectionDocRef.set(
        cOn(
          merge(params.body, {
            uid: collectionId,
            total: 0,
            sold: 0,
            createdBy: owner,
            approved: false,
            rejected: false,
            ipfsMedia: null,
            limitedEdition: !!params.body.limitedEdition,
            placeholderNft: placeholderNftId || null,
            status: CollectionStatus.PRE_MINTED,
          }),
          URL_PATHS.COLLECTION,
        ),
      );

      return <Collection>(await collectionDocRef.get()).data();
    },
  );

export const updateCollection: functions.CloudFunction<Collection> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.uCollection),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
      appCheck(WEN_FUNC.cCollection, context);
      const params = await decodeAuth(req, WEN_FUNC.cCollection);
      const member = params.address.toLowerCase();

      const uidSchema = Joi.object({ uid: CommonJoi.uid() });
      await assertValidationAsync(uidSchema, { uid: params.body.uid });

      const collectionDocRef = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
      const collection = <Collection | undefined>(await collectionDocRef.get()).data();
      if (!collection) {
        throw throwInvalidArgument(WenError.collection_does_not_exists);
      }

      const isMinted = collection.status === CollectionStatus.MINTED;
      const updateSchemaObj = isMinted ? updateMintedCollectionSchema : updateCollectionSchema;
      const schema = Joi.object({ uid: CommonJoi.uid(), ...updateSchemaObj });
      await assertValidationAsync(schema, params.body);

      const memberDocRef = await admin.firestore().collection(COL.MEMBER).doc(member).get();
      if (!memberDocRef.exists) {
        throw throwInvalidArgument(WenError.member_does_not_exists);
      }

      if (params.body.availableFrom) {
        params.body.availableFrom = dateToTimestamp(params.body.availableFrom, true);
      }

      if (collection.createdBy !== member) {
        throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
      }

      if (collection.royaltiesFee < params.body.royaltiesFee) {
        throw throwInvalidArgument(WenError.royalty_fees_can_only_be_reduced);
      }

      const spaceDocRef = admin.firestore().collection(COL.SPACE).doc(collection.space);
      await SpaceValidator.isGuardian(spaceDocRef, member);

      const batch = admin.firestore().batch();
      batch.update(collectionDocRef, uOn(params.body));

      if (!isMinted && collection.placeholderNft) {
        const nftPlaceholder = admin.firestore().collection(COL.NFT).doc(collection.placeholderNft);
        const data = uOn({
          name: params.body.name || '',
          description: params.body.description || '',
          media: params.body.placeholderUrl || '',
          space: collection.space,
          type: collection.type,
        });
        batch.update(nftPlaceholder, data);
      }
      await batch.commit();
      return <Collection>(await collectionDocRef.get()).data();
    },
  );

export const approveCollection: functions.CloudFunction<Collection> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.approveCollection),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
      appCheck(WEN_FUNC.approveCollection, context);
      const params = await decodeAuth(req, WEN_FUNC.approveCollection);
      const member = params.address.toLowerCase();
      const schema = Joi.object({ uid: CommonJoi.uid() });
      await assertValidationAsync(schema, params.body);

      const memberDocRef = await admin.firestore().collection(COL.MEMBER).doc(member).get();
      if (!memberDocRef.exists) {
        throw throwInvalidArgument(WenError.member_does_not_exists);
      }

      const collectionDocRef = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
      const collection = <Collection | undefined>(await collectionDocRef.get()).data();
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

      await collectionDocRef.update(uOn({ approved: true }));

      return <Collection>(await collectionDocRef.get()).data();
    },
  );

export const rejectCollection: functions.CloudFunction<Collection> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.rejectCollection),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Collection> => {
      appCheck(WEN_FUNC.rejectCollection, context);
      const params = await decodeAuth(req, WEN_FUNC.rejectCollection);
      const member = params.address.toLowerCase();
      const schema = Joi.object({ uid: CommonJoi.uid() });
      await assertValidationAsync(schema, params.body);

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

      await collectionDocRef.update(uOn({ approved: false, rejected: true }));

      return <Collection>(await collectionDocRef.get()).data();
    },
  );
