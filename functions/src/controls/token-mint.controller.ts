import { SingleNodeClient } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { DEFAULT_NETWORK } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions';
import { Member, Network, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../interfaces/models';
import { COL, WenRequest } from '../../interfaces/models/base';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { MnemonicService } from '../services/wallet/mnemonic';
import { SmrTokenMinter } from '../services/wallet/SmrTokenMinter';
import { getNodeClient, WalletService } from '../services/wallet/wallet';
import { guardedRerun } from '../utils/common.utils';
import { dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from "../utils/google.utils";
import { assertValidation } from '../utils/schema.utils';
import { cancelSale } from '../utils/token-trade.utils';
import { assertIsGuardian, assertTokenStatus, tokenIsInPublicSalePeriod } from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';
import { Token, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus } from './../../interfaces/models/token';

export const mintTokenOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.mintTokenOrder),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.mintTokenOrder, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema = Joi.object({
    token: Joi.string().required(),
    targetNetwork: Joi.string().equal(Network.SMR, Network.RMS).required()
  });
  assertValidation(schema.validate(params.body));

  const tranId = getRandomEthAddress()
  const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)

  let token: Token | undefined

  await admin.firestore().runTransaction(async (transaction) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
    token = <Token | undefined>(await transaction.get(tokenDocRef)).data()
    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params)
    }
    await assertIsGuardian(token.space, owner)

    if (tokenIsInPublicSalePeriod(token)) {
      throw throwInvalidArgument(WenError.can_not_mint_in_pub_sale)
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.CANCEL_SALE, TokenStatus.PRE_MINTED, TokenStatus.READY_TO_MINT])

    transaction.update(tokenDocRef, { status: TokenStatus.READY_TO_MINT })
  })

  await cancelAllActiveSales(token!.uid)

  const newWallet = WalletService.newWallet(params.body.targetNetwork);
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);

  const minter = new SmrTokenMinter(getNodeClient(params.body.targetNetwork) as SingleNodeClient)
  const wallet = WalletService.newWallet(params.body.targetNetwork)
  const target = await wallet.getAddressDetails(targetAddress.bech32)
  const totalStorageDeposit = await minter.getStorageDepositForMinting(target, token!)

  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: token!.space,
    createdOn: serverTime(),
    sourceNetwork: params.body.targetNetwork || DEFAULT_NETWORK,
    targetNetwork: params.body.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: TransactionOrderType.MINT_TOKEN,
      amount: totalStorageDeposit,
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      token: params.body.token
    },
    linkedTransactions: []
  }
  await tranDocRef.create(data)
  return data
})


const cancelAllActiveSales = async (token: string) => {
  const runTransaction = () => admin.firestore().runTransaction(async (transaction) => {
    const query = admin.firestore().collection(COL.TOKEN_MARKET)
      .where('status', '==', TokenTradeOrderStatus.ACTIVE)
      .where('token', '==', token)
      .limit(150)
    const docRefs = (await query.get()).docs.map(d => d.ref)
    const promises = (isEmpty(docRefs) ? [] : await transaction.getAll(...docRefs))
      .map(doc => cancelSale(transaction, <TokenTradeOrder>doc.data(), TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN))

    return (await Promise.all(promises)).length
  })

  await guardedRerun(async () => await runTransaction() !== 0)
}

export const claimMintedTokenOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.claimMintedTokenOrder),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.claimMintedTokenOrder, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema = Joi.object({ token: Joi.string().required() });
  assertValidation(schema.validate(params.body));

  return await admin.firestore().runTransaction(async (transaction) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`)
    const token = <Token | undefined>((await transaction.get(tokenDocRef))).data()
    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params)
    }

    if (token.status !== TokenStatus.MINTED) {
      throw throwInvalidArgument(WenError.token_not_minted)
    }

    const wallet = WalletService.newWallet(token.mintingData?.network!)

    const targetAddress = await wallet.getNewIotaAddressDetails();
    await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);

    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
    const minter = new SmrTokenMinter(getNodeClient(token.mintingData?.network!) as SingleNodeClient)

    const storageDeposit = await minter.getStorageDepositForClaimingToken(transaction, member, token)

    const tranId = getRandomEthAddress()
    const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)
    const data = <Transaction>{
      type: TransactionType.ORDER,
      uid: tranId,
      member: owner,
      space: token!.space,
      createdOn: serverTime(),
      sourceNetwork: token.mintingData?.network!,
      targetNetwork: token.mintingData?.network!,
      payload: {
        type: TransactionOrderType.CLAIM_MINTED_TOKEN,
        amount: storageDeposit,
        targetAddress: targetAddress.bech32,
        expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        reconciled: false,
        void: false,
        chainReference: null,
        token: params.body.token
      },
      linkedTransactions: []
    }
    await tranDocRef.create(data)
    return data
  })
})
