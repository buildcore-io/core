import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Member, Network, Token, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
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
import { buySellTokenSchema, getNetworkPair } from './common';

export const tradeBaseTokenOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.tradeBaseToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.tradeBaseToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(buySellTokenSchema.validate(params.body, { convert: false }));

  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
  if (!token || !Object.values(Network).includes(token.symbol.toLowerCase() as Network)) {
    throw throwInvalidArgument(WenError.invalid_params)
  }
  const sourceNetwork = token.symbol.toLowerCase() as Network
  const targetNetwork = getNetworkPair(sourceNetwork)

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member, sourceNetwork)
  assertMemberHasValidAddress(member, targetNetwork)

  const tranId = getRandomEthAddress()
  const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)

  const wallet = WalletService.newWallet(sourceNetwork)
  const targetAddress = await wallet.getNewIotaAddressDetails();

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
      amount: Number(bigDecimal.floor(bigDecimal.multiply(params.body.count, params.body.price))),
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
