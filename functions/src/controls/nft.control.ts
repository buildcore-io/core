import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { COL, WenRequest } from '../../interfaces/models/base';
import { Member } from '../../interfaces/models/member';
import { scale } from "../scale.settings";
import { CommonJoi } from '../services/joi/common';
import { cOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { cleanParams, decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { CollectionType } from './../../interfaces/models/collection';
import { MIN_AMOUNT_TO_TRANSFER } from './../services/wallet/wallet';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').required(),
    description: Joi.string().allow(null, '').required(),
    collection: CommonJoi.uidCheck(),
    image: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    availableFrom: Joi.date().greater(Date.now()).required(),
    // Minimum 10Mi price required and max 1Ti
    price: Joi.number().min(10 * 1000 * 1000).max(1000 * 1000 * 1000 * 1000).required(),
    url: Joi.string().allow(null, '').uri({
      scheme: ['https', 'http']
    }).optional(),
    // TODO Validate.
    properties: Joi.object().optional(),
    stats: Joi.object().optional()
  });
}

export const createNft: functions.CloudFunction<Member> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.cNft),
}).https.onCall(async (req: WenRequest, context: any): Promise<Member> => {
  appCheck(WEN_FUNC.cNft, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const creator = params.address.toLowerCase();
  const nftAddress: string = getRandomEthAddress();
  const schema: ObjectSchema<Member> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));

  const docMember: any = await admin.firestore().collection(COL.MEMBER).doc(creator).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refCollection: any = admin.firestore().collection(COL.COLLECTION).doc(params.body.collection);
  const docCollection: any = await refCollection.get();
  if (!docCollection.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  // Royalty from the price must not be below 1 Mi.
  const calculatedRoyalty = docCollection.data().royaltiesFee * params.body.price;
  if (calculatedRoyalty < MIN_AMOUNT_TO_TRANSFER) {
    throw throwInvalidArgument(WenError.royalty_payout_must_be_above_1_mi);
  }

  const refNft: any = admin.firestore().collection(COL.NFT).doc(nftAddress);
  let docNft: any = await refNft.get();
  if (!docNft.exists) {
    // Document does not exists.
    await refNft.set(keywords(cOn(merge(cleanParams(params.body), {
      uid: nftAddress,
      space: docCollection.data().space,
      type: docCollection.data().type,
      hidden: (CollectionType.CLASSIC !== docCollection.data().type),
      createdBy: creator
    }))));

    // Load latest
    docNft = await refNft.get();
  }

  // Return member.
  return <Member>docNft.data();
});
