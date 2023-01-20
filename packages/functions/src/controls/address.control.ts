import {
  COL,
  DEFAULT_NETWORK,
  Member,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { createAddressValidationOrder } from '../services/payment/tangle-service/address-validation.service';
import { networks } from '../utils/config.utils';
import { cOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { decodeAuth } from '../utils/wallet.utils';

export const validateAddressSchema = {
  space: CommonJoi.uid(false).optional(),
  network: Joi.string()
    .equal(...networks)
    .optional(),
};

export const validateAddress = functions
  .runWith({
    minInstances: scale(WEN_FUNC.validateAddress),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.validateAddress, context);
    const params = await decodeAuth(req, WEN_FUNC.validateAddress);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(validateAddressSchema);
    await assertValidationAsync(schema, params.body);

    const network = params.body.network || DEFAULT_NETWORK;
    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${owner}`);
    const member = <Member | undefined>(await memberDocRef.get()).data();

    if (!member) {
      throw throwInvalidArgument(WenError.member_does_not_exists);
    }

    const order = await createAddressValidationOrder(member.uid, network, params.body.space);
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
    return order;
  });
