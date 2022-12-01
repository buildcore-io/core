import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  DEFAULT_NETWORK,
  getNetworkPair,
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
  URL_PATHS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import bigDecimal from 'js-big-decimal';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { isProdEnv } from '../../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

const tradeTokenSchema = Joi.object({
  token: CommonJoi.uid(),
  count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
  price: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required(),
  type: Joi.string().equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY).required(),
}).custom((obj, helper) => {
  if (Number(bigDecimal.multiply(obj.price, obj.count)) < MIN_IOTA_AMOUNT) {
    return helper.error('Order total min value is: ' + MIN_IOTA_AMOUNT);
  }
  return obj;
});

export const tradeToken = functions
  .runWith({
    minInstances: scale(WEN_FUNC.tradeToken),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req, WEN_FUNC.tradeToken);
    const owner = params.address.toLowerCase();
    await assertValidationAsync(tradeTokenSchema, params.body, { convert: false });
    const isSell = params.body.type === TokenTradeOrderType.SELL;

    const token = <Token | undefined>(
      (await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
    );
    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params);
    }
    if (isProdEnv()) {
      await assertIpNotBlocked(context.rawRequest?.ip || '', token.uid, 'token');
    }
    assertTokenApproved(token, [TokenStatus.MINTED, TokenStatus.BASE].includes(token.status));
    assertTokenStatus(token, [
      TokenStatus.AVAILABLE,
      TokenStatus.PRE_MINTED,
      TokenStatus.MINTED,
      TokenStatus.BASE,
    ]);

    const [sourceNetwork, targetNetwork] = getSourceAndTargetNetwork(token, isSell);
    const member = <Member | undefined>(
      (await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
    );
    assertMemberHasValidAddress(member, sourceNetwork);
    assertMemberHasValidAddress(member, targetNetwork);

    if ([TokenStatus.BASE, TokenStatus.MINTED].includes(token.status) || !isSell) {
      const tradeOrder = await createTradeOrder(
        token,
        owner,
        sourceNetwork,
        isSell,
        Number(params.body.count),
        Number(params.body.price),
      );
      await admin
        .firestore()
        .doc(`${COL.TRANSACTION}/${tradeOrder.uid}`)
        .create(cOn(tradeOrder, URL_PATHS.TRANSACTION));
      return tradeOrder;
    }

    return await admin.firestore().runTransaction(async (transaction) => {
      const distributionDocRef = admin
        .firestore()
        .doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`);
      const distribution = <TokenDistribution | undefined>(
        (await transaction.get(distributionDocRef)).data()
      );
      if (!distribution) {
        throw throwInvalidArgument(WenError.invalid_params);
      }
      const tokensLeftForSale = (distribution.tokenOwned || 0) - (distribution.lockedForSale || 0);
      if (Number(params.body.count) > tokensLeftForSale) {
        throw throwInvalidArgument(WenError.no_available_tokens_for_sale);
      }
      const tradeOrder = cOn(
        <TokenTradeOrder>{
          uid: getRandomEthAddress(),
          owner,
          token: token.uid,
          tokenStatus: token.status,
          type: TokenTradeOrderType.SELL,
          count: Number(params.body.count),
          price: Number(params.body.price),
          totalDeposit: params.body.count,
          balance: params.body.count,
          fulfilled: 0,
          status: TokenTradeOrderStatus.ACTIVE,
          expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms')),
          sourceNetwork,
          targetNetwork,
        },
        URL_PATHS.TOKEN_MARKET,
      );

      transaction.create(
        admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`),
        cOn(tradeOrder, URL_PATHS.TRANSACTION),
      );
      transaction.update(
        distributionDocRef,
        uOn({
          lockedForSale: admin.firestore.FieldValue.increment(Number(params.body.count)),
        }),
      );
      return tradeOrder;
    });
  });

const getSourceAndTargetNetwork = (token: Token, isSell: boolean) => {
  if (token.status === TokenStatus.BASE) {
    const sourceNetwork = token.symbol.toLowerCase() as Network;
    const targetNetwork = getNetworkPair(sourceNetwork);
    return isSell ? [sourceNetwork, targetNetwork] : [targetNetwork, sourceNetwork];
  }
  if (token.status === TokenStatus.MINTED) {
    return [token.mintingData?.network!, token.mintingData?.network!];
  }
  return [DEFAULT_NETWORK, DEFAULT_NETWORK];
};

const createTradeOrder = async (
  token: Token,
  member: string,
  network: Network,
  isSell: boolean,
  count: number,
  price: number,
) => {
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const isMinted = token.status === TokenStatus.MINTED;
  return <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member,
    space: token.space || '',
    network,
    payload: {
      type: isSell ? TransactionOrderType.SELL_TOKEN : TransactionOrderType.BUY_TOKEN,
      amount: await getAmount(token, count, price, isSell),
      nativeTokens: isMinted && isSell ? [{ id: token.mintingData?.tokenId!, amount: count }] : [],
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(
        dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
      ),
      validationType: getValidationType(token, isSell),
      reconciled: false,
      void: false,
      chainReference: null,
      token: token.uid,
      count,
      price,
    },
    linkedTransactions: [],
  };
};

const getAmount = async (token: Token, count: number, price: number, isSell: boolean) => {
  if (!isSell) {
    return Number(bigDecimal.floor(bigDecimal.multiply(count, price)));
  }
  if (token.status !== TokenStatus.MINTED) {
    return count;
  }
  const wallet = (await WalletService.newWallet(token.mintingData?.network)) as SmrWallet;
  const tmpAddress = await wallet.getNewIotaAddressDetails(false);
  const nativeTokens = [
    { amount: HexHelper.fromBigInt256(bigInt(count)), id: token.mintingData?.tokenId! },
  ];
  const output = packBasicOutput(tmpAddress.bech32, 0, nativeTokens, wallet.info);
  return Number(output.amount);
};

const getValidationType = (token: Token, isSell: boolean) =>
  isSell && token.status === TokenStatus.MINTED
    ? TransactionValidationType.ADDRESS
    : TransactionValidationType.ADDRESS_AND_AMOUNT;
