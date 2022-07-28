import { TransactionHelper } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { DEFAULT_NETWORK } from '../../../interfaces/config';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Member, Network, Token, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../../interfaces/models';
import { COL, WenRequest } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { createAliasOutput } from '../../services/payment/token/mint-utils/alias.utils';
import { createFoundryOutput, getVaultAndGuardianOutput } from '../../services/payment/token/mint-utils/foundry.utils';
import { getTotalDistributedTokenCount } from '../../services/payment/token/mint-utils/member.utils';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { guardedRerun } from '../../utils/common.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus, tokenIsInPublicSalePeriod } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

export const mintTokenOrder = functions.runWith({
  minInstances: scale(WEN_FUNC.mintTokenOrder),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.mintTokenOrder, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema = Joi.object({
    token: Joi.string().required(),
    targetNetwork: Joi.string().equal(Network.RMS).required()
  });
  assertValidation(schema.validate(params.body));

  const tranId = getRandomEthAddress()
  const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)

  return await admin.firestore().runTransaction(async (transaction) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
    const token = <Token | undefined>(await transaction.get(tokenDocRef)).data()
    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params)
    }

    assertTokenApproved(token, true)

    if (tokenIsInPublicSalePeriod(token)) {
      throw throwInvalidArgument(WenError.can_not_mint_in_pub_sale)
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.CANCEL_SALE, TokenStatus.PRE_MINTED, TokenStatus.READY_TO_MINT])

    await assertIsGuardian(token.space, owner)
    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
    assertMemberHasValidAddress(member, params.body.targetNetwork)

    await cancelAllActiveSales(token!.uid)

    const wallet = WalletService.newWallet(params.body.targetNetwork) as SmrWallet;
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const totalStorageDeposit = await getStorageDepositForMinting(token, targetAddress, wallet)

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
    transaction.update(tokenDocRef, { status: TokenStatus.READY_TO_MINT })
    return data
  })
})

const cancelAllActiveSales = async (token: string) => {
  const runTransaction = () => admin.firestore().runTransaction(async (transaction) => {
    const query = admin.firestore().collection(COL.TOKEN_MARKET)
      .where('status', '==', TokenTradeOrderStatus.ACTIVE)
      .where('token', '==', token)
      .limit(150)
    const docRefs = (await query.get()).docs.map(d => d.ref)
    const promises = (isEmpty(docRefs) ? [] : await transaction.getAll(...docRefs))
      .map(d => <TokenTradeOrder>d.data())
      .filter(d => d.status === TokenTradeOrderStatus.ACTIVE)
      .map(d => cancelTradeOrderUtil(transaction, d, TokenTradeOrderStatus.EXPIRED))

    return (await Promise.all(promises)).length
  })

  await guardedRerun(async () => await runTransaction() !== 0)
}

const getStorageDepositForMinting = async (token: Token, address: AddressDetails, wallet: SmrWallet) => {
  const info = await wallet.client.info()
  const aliasOutput = createAliasOutput(0, address.hex)
  const foundryOutput = createFoundryOutput(token.totalSupply, aliasOutput, JSON.stringify({ uid: token.uid, symbol: token.symbol }))
  const totalDistributed = await getTotalDistributedTokenCount(token)
  const vaultAndGuardianOutput = await getVaultAndGuardianOutput(aliasOutput, foundryOutput, totalDistributed, address, address.bech32, token.totalSupply, info)
  const aliasStorageDep = TransactionHelper.getStorageDeposit(aliasOutput, info.protocol.rentStructure)
  const foundryStorageDep = TransactionHelper.getStorageDeposit(foundryOutput, info.protocol.rentStructure)
  return aliasStorageDep + foundryStorageDep + vaultAndGuardianOutput.reduce((acc, act) => acc + Number(act.amount), 0)
}
