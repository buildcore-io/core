import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import bigDecimal from 'js-big-decimal';
import { MAX_IOTA_AMOUNT, MAX_TOTAL_TOKEN_SUPPLY, MIN_IOTA_AMOUNT } from '../../../interfaces/config';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { getNetworkPair, Member, Network, Token, TokenTradeOrderType, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

export const tradeBaseTokenOrderSchema = Joi.object({
  network: Joi.number().equal(Network.ATOI, Network.RMS).required(),
  count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
  price: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required()
}).custom((obj, helper) => {
  if (Number(bigDecimal.multiply(obj.price, obj.count)) < MIN_IOTA_AMOUNT) {
    return helper.error('Order total min value is: ' + MIN_IOTA_AMOUNT);
  }
  return obj
});

export const tradeBaseTokenOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.tradeBaseToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.tradeBaseToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(tradeBaseTokenOrderSchema.validate(params.body, { convert: false }));

  const symbol = getSymbolForNetwork(params.body.network)
  const token = <Token | undefined>(await admin.firestore().collection(COL.TOKEN).where('symbol', '==', symbol).get()).docs[0]?.data()
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params)
  }
  const sourceNetwork = params.body.network
  const targetNetwork = getNetworkPair(sourceNetwork)

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member, sourceNetwork)
  assertMemberHasValidAddress(member, targetNetwork)

  const tranId = getRandomEthAddress()
  const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)

  const wallet = await WalletService.newWallet(sourceNetwork)
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const type = [Network.SMR, Network.RMS].includes(sourceNetwork) ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY;
  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: token.space || '',
    createdOn: serverTime(),
    sourceNetwork,
    targetNetwork,
    payload: {
      type: TransactionOrderType.TRADE_BASE_TOKEN,
      amount: type === TokenTradeOrderType.SELL ? Number(bigDecimal.floor(bigDecimal.multiply(params.body.count, params.body.price))) : Number(bigDecimal.floor(params.body.count)),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      token: token.uid,
      count: Number(params.body.count),
      price: Number(params.body.price)
    },
    linkedTransactions: []
  }
  await tranDocRef.create(data)
  return <Transaction>(await tranDocRef.get()).data()
})


const getSymbolForNetwork = (network: Network) => {
  switch (network) {
    case Network.RMS: return Network.ATOI.toUpperCase();
    case Network.SMR: return Network.IOTA.toUpperCase();
    case Network.IOTA, Network.ATOI: return network.toUpperCase()
    default: return ''
  }
}
