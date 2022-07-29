import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Member, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import { Token, TokenStatus } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { generateRandomAmount } from '../../utils/common.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { assertValidation } from '../../utils/schema.utils';
import { assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { buySellTokenSchema } from './common';

export const sellMintedTokenOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.sellMintedToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.sellMintedToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(buySellTokenSchema.validate(params.body, { convert: false }));

  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params);
  }

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  assertMemberHasValidAddress(member, token.mintingData?.network!)

  if (isProdEnv()) {
    await assertIpNotBlocked(context.rawRequest?.ip || '', token.uid, 'token')
  }

  assertTokenApproved(token, true);
  assertTokenStatus(token, [TokenStatus.MINTED]);

  const tranId = getRandomEthAddress()
  const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)

  const wallet = WalletService.newWallet(token.mintingData?.network!)
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: token!.space,
    createdOn: serverTime(),
    sourceNetwork: token.mintingData?.network!,
    targetNetwork: token.mintingData?.network!,
    payload: {
      type: TransactionOrderType.SELL_MINTED_TOKEN,
      amount: generateRandomAmount(),
      nativeTokens: [{ id: token.mintingData?.tokenId!, amount: params.body.count }],
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      chainReference: null,
      token: params.body.token,
      count: Number(params.body.count),
      price: Number(params.body.price)
    },
    linkedTransactions: []
  }
  await tranDocRef.create(data)
  return <Transaction>(await tranDocRef.get()).data()
})
