import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import bigDecimal from 'js-big-decimal';
import { MAX_IOTA_AMOUNT, MAX_TOTAL_TOKEN_SUPPLY, MIN_IOTA_AMOUNT } from '../../../interfaces/config';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Member, Network, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { MnemonicService } from '../../services/wallet/mnemonic';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { getNetworkPair } from './common';

const schema = Joi.object({
  sourceNetwork: Joi.string().equal(Network.ATOI, Network.RMS).required(),
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
  assertValidation(schema.validate(params.body, { convert: false }));

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member?.validatedAddress, params.body.sourceNetwork)
  const targetNetwork = getNetworkPair(params.body.sourceNetwork)
  assertMemberHasValidAddress(member?.validatedAddress, targetNetwork)

  const tranId = getRandomEthAddress()
  const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)

  const wallet = WalletService.newWallet(params.body.sourceNetwork)
  const targetAddress = await wallet.getNewIotaAddressDetails();
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);

  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: '',
    createdOn: serverTime(),
    sourceNetwork: params.body.sourceNetwork,
    targetNetwork,
    payload: {
      type: TransactionOrderType.TRADE_BASE_TOKEN,
      amount: Number(bigDecimal.floor(bigDecimal.multiply(params.body.count, params.body.price))),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      count: Number(params.body.count),
      price: Number(params.body.price)
    },
    linkedTransactions: []
  }
  await tranDocRef.create(data)
  return <Transaction>(await tranDocRef.get()).data()
})
