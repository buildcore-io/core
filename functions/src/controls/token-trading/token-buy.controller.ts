import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import bigDecimal from 'js-big-decimal';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Member, Network, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import { Token, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { scale } from "../../scale.settings";
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { assertValidation } from '../../utils/schema.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { assertTokenApproved, assertTokenStatus, DEFAULT_VALID_STATUSES } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { buySellTokenSchema } from './common';

export const cancelTradeOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.cancelTradeOrder),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cancelTradeOrder, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object({ uid: Joi.string().required() });
  assertValidation(schema.validate(params.body));

  return await admin.firestore().runTransaction(async (transaction) => {
    const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${params.body.uid}`)
    const tradeOrder = <TokenTradeOrder | undefined>(await transaction.get(tradeOrderDocRef)).data()
    if (!tradeOrder || tradeOrder.owner !== owner || tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
      throw throwInvalidArgument(WenError.invalid_params)
    }
    return await cancelTradeOrderUtil(transaction, tradeOrder)
  })
})

export const buyToken = functions.runWith({
  minInstances: scale(WEN_FUNC.buyToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.buyToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(buySellTokenSchema.validate(params.body, { convert: false }));

  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data();
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params)
  }
  const network = token.mintingData?.network || Network.IOTA
  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member, network)

  if (isProdEnv()) {
    await assertIpNotBlocked(context.rawRequest?.ip || '', token.uid, 'token')
  }

  assertTokenApproved(token, token.status === TokenStatus.MINTED);
  assertTokenStatus(token, [...DEFAULT_VALID_STATUSES, TokenStatus.MINTED]);

  const tranId = getRandomEthAddress();
  const newWallet = WalletService.newWallet(network);
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const orderDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId)

  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: token.space,
    createdOn: serverTime(),
    sourceNetwork: network,
    targetNetwork: network,
    payload: {
      type: TransactionOrderType.TOKEN_BUY,
      amount: Number(bigDecimal.floor(bigDecimal.multiply(params.body.count, params.body.price))),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      token: params.body.token,
      count: Number(params.body.count),
      price: Number(params.body.price)
    },
    linkedTransactions: []
  }
  await orderDoc.create(data);
  return <Transaction>(await orderDoc.get()).data()
})
