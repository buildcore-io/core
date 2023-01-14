import { COL, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { createNftPuchaseOrder } from '../../services/payment/tangle-service/nft-purchase.service';
import { cOn } from '../../utils/dateTime.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

const nftPurchaseSchema = {
  collection: CommonJoi.uid(),
  nft: CommonJoi.uid(false),
};

export const orderNft = functions
  .runWith({
    minInstances: scale(WEN_FUNC.orderNft),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.orderNft, context);
    const params = await decodeAuth(req, WEN_FUNC.orderNft);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(nftPurchaseSchema);
    await assertValidationAsync(schema, params.body);

    const order = await createNftPuchaseOrder(
      params.body.collection,
      params.body.nft,
      owner,
      context.rawRequest?.ip,
    );
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
    return order;
  });
