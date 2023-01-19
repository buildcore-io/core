import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  DEFAULT_NETWORK,
  getNetworkPair,
  MAX_IOTA_AMOUNT,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
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
  TransactionUnlockType,
  TransactionValidationType,
  TRANSACTION_MAX_EXPIRY_MS,
  URL_PATHS,
  WenError,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import Joi from 'joi';
import bigDecimal from 'js-big-decimal';
import { get, set } from 'lodash';
import admin from '../../../admin.config';
import { tradeTokenSchema } from '../../../controls/token-trading/token-trade.controller';
import { SmrWallet } from '../../../services/wallet/SmrWalletService';
import { WalletService } from '../../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../../utils/address.utils';
import { packBasicOutput } from '../../../utils/basic-output.utils';
import { isProdEnv } from '../../../utils/config.utils';
import { cOn, dateToTimestamp } from '../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../utils/ip.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import {
  assertTokenApproved,
  assertTokenStatus,
  getTokenBySymbol,
} from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { CommonJoi } from '../../joi/common';
import { TransactionMatch, TransactionService } from '../transaction-service';

const sellMintedTokenSchema = Joi.object({
  symbol: CommonJoi.tokenSymbol(),
  price: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required(),
  type: Joi.string().equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY).required(),
});

export class TangleTokenTradeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleTokenTradeTangleRequest = async (
    match: TransactionMatch,
    payment: Transaction,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
    soonTransaction?: Transaction,
  ) => {
    const type =
      request.requestType === TransactionOrderType.BUY_TOKEN
        ? TokenTradeOrderType.BUY
        : TokenTradeOrderType.SELL;
    const params = {
      symbol: request.symbol,
      price: request.price,
      type,
    };
    await assertValidationAsync(sellMintedTokenSchema, params);

    let token = await getTokenBySymbol(params.symbol as string);
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token?.uid}`);
    token = <Token | undefined>(await this.transactionService.transaction.get(tokenDocRef)).data();
    if (!token) {
      throw throwInvalidArgument(WenError.token_does_not_exist);
    }

    if (type !== TokenTradeOrderType.SELL || token.status !== TokenStatus.MINTED) {
      set(params, 'count', request.count);
      await assertValidationAsync(tradeTokenSchema, params);
    }

    const { tradeOrderTransaction } = await createTokenTradeOrder(
      this.transactionService.transaction,
      owner,
      token,
      params.type,
      get(params, 'count', 0),
      params.price as number,
      '',
      [TokenStatus.BASE, TokenStatus.MINTED],
    );

    if (!tradeOrderTransaction) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    if (params.type === TokenTradeOrderType.SELL && token?.status === TokenStatus.MINTED) {
      set(tradeOrderTransaction, 'payload.amount', tranEntry.amount);
    }
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${tradeOrderTransaction.uid}`),
      data: tradeOrderTransaction,
      action: 'set',
    });

    if (params.type === TokenTradeOrderType.SELL && token?.status === TokenStatus.BASE) {
      this.transactionService.createTangleCredit(
        payment,
        match,
        {
          amount: tradeOrderTransaction.payload.amount,
          address: tradeOrderTransaction.payload.targetAddress,
        },
        tranEntry.outputId!,
      );
      return;
    }

    this.transactionService.createUnlockTransaction(
      tradeOrderTransaction,
      tran,
      tranEntry,
      TransactionUnlockType.TANGLE_TRANSFER,
      tranEntry.outputId,
      soonTransaction?.payload?.expiresOn ||
        dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms')),
    );
    return;
  };
}

const ACCEPTED_TOKEN_STATUSES = [
  TokenStatus.AVAILABLE,
  TokenStatus.PRE_MINTED,
  TokenStatus.MINTED,
  TokenStatus.BASE,
];
export const createTokenTradeOrder = async (
  transaction: admin.firestore.Transaction,
  owner: string,
  token: Token,
  type: TokenTradeOrderType,
  count: number,
  price: number,
  ip = '',
  acceptedTokenStatuses = ACCEPTED_TOKEN_STATUSES,
) => {
  const isSell = type === TokenTradeOrderType.SELL;
  if (isProdEnv()) {
    await assertIpNotBlocked(ip || '', token.uid, 'token');
  }
  assertTokenApproved(token, [TokenStatus.MINTED, TokenStatus.BASE].includes(token.status));
  assertTokenStatus(token, acceptedTokenStatuses);

  const [sourceNetwork, targetNetwork] = getSourceAndTargetNetwork(token, isSell);
  const member = <Member | undefined>(
    (await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  );
  assertMemberHasValidAddress(member, sourceNetwork);
  assertMemberHasValidAddress(member, targetNetwork);

  if ([TokenStatus.BASE, TokenStatus.MINTED].includes(token.status) || !isSell) {
    const tradeOrderTransaction = await createTradeOrderTransaction(
      token,
      owner,
      sourceNetwork,
      isSell,
      Number(count),
      Number(price),
    );

    return { tradeOrderTransaction, tradeOrder: undefined, distribution: undefined };
  }

  const distributionDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${owner}`);
  const distribution = <TokenDistribution | undefined>(
    (await transaction.get(distributionDocRef)).data()
  );
  if (!distribution) {
    throw throwInvalidArgument(WenError.invalid_params);
  }
  const tokensLeftForSale = (distribution.tokenOwned || 0) - (distribution.lockedForSale || 0);
  if (Number(count) > tokensLeftForSale) {
    throw throwInvalidArgument(WenError.no_available_tokens_for_sale);
  }
  const tradeOrder = cOn(
    <TokenTradeOrder>{
      uid: getRandomEthAddress(),
      owner,
      token: token.uid,
      tokenStatus: token.status,
      type: TokenTradeOrderType.SELL,
      count: Number(count),
      price: Number(price),
      totalDeposit: count,
      balance: count,
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
      expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS)),
      sourceNetwork,
      targetNetwork,
    },
    URL_PATHS.TOKEN_MARKET,
  );

  return {
    tradeOrderTransaction: undefined,
    tradeOrder,
    distribution: {
      lockedForSale: admin.firestore.FieldValue.increment(Number(count)),
    },
  };
};

const getSourceAndTargetNetwork = (token: Token, isSell: boolean) => {
  if (token.status === TokenStatus.BASE) {
    const sourceNetwork = token.mintingData?.network! as Network;
    const targetNetwork = getNetworkPair(sourceNetwork);
    return isSell ? [sourceNetwork, targetNetwork] : [targetNetwork, sourceNetwork];
  }

  if (token.status === TokenStatus.MINTED) {
    return [token.mintingData?.network!, token.mintingData?.network!];
  }

  return [DEFAULT_NETWORK, DEFAULT_NETWORK];
};

const createTradeOrderTransaction = async (
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
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS)),
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
