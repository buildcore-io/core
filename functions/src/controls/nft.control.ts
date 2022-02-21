import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { MAX_IOTA_AMOUNT, MIN_AMOUNT_TO_TRANSFER, MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { COL, WenRequest } from '../../interfaces/models/base';
import { Member } from '../../interfaces/models/member';
import { scale } from "../scale.settings";
import { CommonJoi } from '../services/joi/common';
import { cOn, dateToTimestamp } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { cleanParams, decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { CollectionType } from './../../interfaces/models/collection';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').required(),
    description: Joi.string().allow(null, '').required(),
    collection: CommonJoi.uidCheck(),
    media: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    availableFrom: Joi.date().required(),
    // Minimum 10Mi price required and max 1Ti
    price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
    url: Joi.string().allow(null, '').uri({
      scheme: ['https', 'http']
    }).optional(),
    // TODO Validate.
    properties: Joi.object().optional(),
    stats: Joi.object().optional()
  });
}

export const createNft: functions.CloudFunction<Member> = functions.runWith({
  minInstances: scale(WEN_FUNC.cNft),
}).https.onCall(async (req: WenRequest, context: any): Promise<Member> => {
  appCheck(WEN_FUNC.cNft, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const creator = params.address.toLowerCase();
  const schema: ObjectSchema<Member> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));
  return processOneCreateNft(creator, params.body);
});

export const createBatchNft: functions.CloudFunction<string[]> = functions.runWith({
  minInstances: scale(WEN_FUNC.cBatchNft),
  timeoutSeconds: 300,
  memory: "4GB",
}).https.onCall(async (req: WenRequest, context: any): Promise<Member> => {
  appCheck(WEN_FUNC.cBatchNft, context);

  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const creator = params.address.toLowerCase();
  const schema: any = Joi.array().items(Joi.object().keys(defaultJoiUpdateCreateSchema())).max(500);
  assertValidation(schema.validate(params.body));

  // Batch create.
  const process: any = [];
  for (const b of params.body) {
    process.push(processOneCreateNft(creator, b));
  }

  // Wait for it complete.
  const output: Member[] = await Promise.all(process);
  return <any>output.map((o) => {
    return o.uid;
  });
});

const processOneCreateNft = async (creator: string, params: any): Promise<Member> => {
  const nftAddress: string = getRandomEthAddress();
  const docMember: any = await admin.firestore().collection(COL.MEMBER).doc(creator).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refCollection: any = admin.firestore().collection(COL.COLLECTION).doc(params.collection);
  const docCollection: any = await refCollection.get();
  if (!docCollection.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  // Royalty from the price must not be below 1 Mi.
  const calculatedRoyalty = docCollection.data().royaltiesFee * params.price;
  if (calculatedRoyalty < MIN_AMOUNT_TO_TRANSFER) {
    throw throwInvalidArgument(WenError.royalty_payout_must_be_above_1_mi);
  }

  if (docCollection.data().createdBy !== creator) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom);
  }

  if (docCollection.data().type === CollectionType.GENERATED || docCollection.data().type === CollectionType.SFT) {
    params.price = docCollection.data().price || 0;
    params.availableFrom = docCollection.data().availableFrom || docCollection.data().createdOn;
  }

  const refNft: any = admin.firestore().collection(COL.NFT).doc(nftAddress);
  let docNft: any = await refNft.get();
  if (!docNft.exists) {
    // Document does not exists.
    await refNft.set(keywords(cOn(merge(cleanParams(params), {
      uid: nftAddress,
      locked: false,
      position: docCollection.data().total + 1,
      lockedBy: null,
      ipfsMedia: null,
      ipfsMetadata: null,
      sold: false,
      owner: null,
      ipfsRetries: 0,
      space: docCollection.data().space,
      type: docCollection.data().type,
      hidden: (CollectionType.CLASSIC !== docCollection.data().type),
      createdBy: creator,
      placeholderNft: false
    }))));

    // Update collection.
    await refCollection.update({
      total: admin.firestore.FieldValue.increment(1)
    });

    // Let's validate if collection has pending item to sell.
    if (docCollection.data().placeholderNft) {
      await admin.firestore().collection(COL.NFT).doc(docCollection.data().placeholderNft).update({
        sold: false,
        hidden: false
      });
    }

    // Load latest
    docNft = await refNft.get();
  }

  // Return member.
  return <Member>docNft.data();
}
