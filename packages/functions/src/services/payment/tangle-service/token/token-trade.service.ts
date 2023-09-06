import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  SUB_COL,
  TRANSACTION_MAX_EXPIRY_MS,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
  getNetworkPair,
} from '@build-5/interfaces';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { set } from 'lodash';
import { assertMemberHasValidAddress } from '../../../../utils/address.utils';
import { packBasicOutput } from '../../../../utils/basic-output.utils';
import { isProdEnv } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../../utils/ip.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import {
  assertTokenApproved,
  assertTokenStatus,
  getTokenBySymbol,
} from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { SmrWallet } from '../../../wallet/SmrWalletService';
import { WalletService } from '../../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../../transaction-service';
import { tradeMintedTokenSchema } from './TokenTradeTangleRequestSchema';

export class TangleTokenTradeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleTokenTradeTangleRequest = async (
    match: TransactionMatch,
    payment: Transaction,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
    build5Transaction?: Transaction,
  ) => {
    const type =
      request.requestType === TransactionPayloadType.BUY_TOKEN
        ? TokenTradeOrderType.BUY
        : TokenTradeOrderType.SELL;
    const params = await assertValidationAsync(tradeMintedTokenSchema, { ...request, type });

    let token = await getTokenBySymbol(params.symbol);
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token?.uid}`);
    token = await this.transactionService.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }
    if (token.tradingDisabled) {
      throw invalidArgument(WenError.token_trading_disabled);
    }

    const { tradeOrderTransaction } = await createTokenTradeOrder(
      this.transactionService.transaction,
      owner,
      token,
      params.type as TokenTradeOrderType,
      params.count || 0,
      params.price,
      '',
      [TokenStatus.BASE, TokenStatus.MINTED],
    );

    if (!tradeOrderTransaction) {
      throw invalidArgument(WenError.invalid_params);
    }

    if (params.type === TokenTradeOrderType.SELL && token?.status === TokenStatus.MINTED) {
      set(tradeOrderTransaction, 'payload.amount', tranEntry.amount);
    }
    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${tradeOrderTransaction.uid}`),
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
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
      build5Transaction?.payload?.expiresOn ||
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
  transaction: ITransaction,
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
  const member = await build5Db().doc(`${COL.MEMBER}/${owner}`).get<Member>();
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

  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
  const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(owner);
  const distribution = await transaction.get<TokenDistribution>(distributionDocRef);
  if (!distribution) {
    throw invalidArgument(WenError.invalid_params);
  }
  const tokensLeftForSale = (distribution.tokenOwned || 0) - (distribution.lockedForSale || 0);
  if (Number(count) > tokensLeftForSale) {
    throw invalidArgument(WenError.no_available_tokens_for_sale);
  }
  const tradeOrder = <TokenTradeOrder>{
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
  };

  return {
    tradeOrderTransaction: undefined,
    tradeOrder,
    distribution: {
      lockedForSale: build5Db().inc(Number(count)),
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
): Promise<Transaction> => {
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const isMinted = token.status === TokenStatus.MINTED;
  return {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member,
    space: token.space || '',
    network,
    payload: {
      type: isSell ? TransactionPayloadType.SELL_TOKEN : TransactionPayloadType.BUY_TOKEN,
      amount: await getAmount(token, count, price, isSell),
      nativeTokens:
        isMinted && isSell ? [{ id: token.mintingData?.tokenId!, amount: count.toString() }] : [],
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
