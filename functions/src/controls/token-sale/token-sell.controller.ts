import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { URL_PATHS } from '../../../interfaces/config';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Member, Network, TRANSACTION_MAX_EXPIRY_MS } from '../../../interfaces/models';
import { COL, SUB_COL, WenRequest } from '../../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenDistribution } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { cOn, dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { assertValidation } from '../../utils/schema.utils';
import { assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { buySellTokenSchema } from './common';

export const sellToken = functions.runWith({
  minInstances: scale(WEN_FUNC.sellToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.sellToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(buySellTokenSchema.validate(params.body, { convert: false }));

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member?.validatedAddress, Network.IOTA)

  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked(context.rawRequest?.ip || '', token.uid, 'token')
  }

  assertTokenApproved(token);
  assertTokenStatus(token);

  const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`);
  const sellDocId = getRandomEthAddress();
  const sellDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${sellDocId}`);

  await admin.firestore().runTransaction(async (transaction) => {
    const distributionDoc = await transaction.get(distributionDocRef)
    if (!distributionDoc.exists) {
      throw throwInvalidArgument(WenError.invalid_params)
    }
    const distribution = <TokenDistribution>distributionDoc.data();
    const tokensLeftForSale = (distribution.tokenOwned || 0) - (distribution.lockedForSale || 0);
    if (Number(params.body.count) > tokensLeftForSale) {
      throw throwInvalidArgument(WenError.no_available_tokens_for_sale)
    }
    const data = cOn(<TokenBuySellOrder>{
      uid: sellDocId,
      owner,
      token: params.body.token,
      type: TokenBuySellOrderType.SELL,
      count: Number(params.body.count),
      price: Number(params.body.price),
      totalDeposit: Number(bigDecimal.floor(bigDecimal.multiply(params.body.count, params.body.price))),
      balance: 0,
      fulfilled: 0,
      status: TokenBuySellOrderStatus.ACTIVE,
      expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms'))
    }, URL_PATHS.TOKEN_MARKET)
    transaction.create(sellDocRef, data)
    transaction.update(distributionDocRef, { lockedForSale: admin.firestore.FieldValue.increment(Number(params.body.count)) })
  });
  return <TokenBuySellOrder>(await sellDocRef.get()).data()
})
