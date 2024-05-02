import { ITransaction, database } from '@buildcore/database';
import {
  COL,
  DEFAULT_NETWORK,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_PRICE_PER_TOKEN,
  Network,
  SUB_COL,
  TRANSACTION_MAX_EXPIRY_MS,
  TangleResponse,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  TradeTokenTangleRequest,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
  getNetworkPair,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { head, set } from 'lodash';
import { assertMemberHasValidAddress } from '../../../../utils/address.utils';
import { getProject } from '../../../../utils/common.utils';
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
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { tradeMintedTokenSchema } from './TokenTradeTangleRequestSchema';

export class TangleTokenTradeService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    order,
    tran,
    tranEntry,
    owner,
    request,
    buildcoreTran,
    payment,
  }: HandlerParams) => {
    const type =
      request.requestType === TransactionPayloadType.BUY_TOKEN
        ? TokenTradeOrderType.BUY
        : TokenTradeOrderType.SELL;
    const params = await assertValidationAsync(tradeMintedTokenSchema, request);

    const symbol =
      params.symbol ||
      (type === TokenTradeOrderType.SELL ? order.network : getNetworkPair(order.network));
    let token = await getTokenBySymbol(symbol);
    const tokenDocRef = database().doc(COL.TOKEN, token?.uid!);
    token = await this.transaction.get(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }
    if (token.tradingDisabled) {
      throw invalidArgument(WenError.token_trading_disabled);
    }

    const { tradeOrderTransaction } = await createTokenTradeOrder(
      getProject(order),
      this.transactionService.transaction,
      owner,
      token,
      type,
      getCount(params, type),
      await getPrice(this.transactionService.transaction, params, type, token.uid),
      params.targetAddress,
      '',
      [TokenStatus.BASE, TokenStatus.MINTED],
    );

    if (!tradeOrderTransaction) {
      throw invalidArgument(WenError.invalid_params);
    }

    if (type === TokenTradeOrderType.SELL && token?.status === TokenStatus.MINTED) {
      set(tradeOrderTransaction, 'payload.amount', tranEntry.amount);
    }
    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, tradeOrderTransaction.uid),
      data: tradeOrderTransaction,
      action: Action.C,
    });

    this.transactionService.createUnlockTransaction(
      payment,
      tradeOrderTransaction,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
      buildcoreTran?.payload?.expiresOn || dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS)),
    );

    return {};
  };
}

const ACCEPTED_TOKEN_STATUSES = [
  TokenStatus.AVAILABLE,
  TokenStatus.PRE_MINTED,
  TokenStatus.MINTED,
  TokenStatus.BASE,
];

export const createTokenTradeOrder = async (
  project: string,
  transaction: ITransaction,
  owner: string,
  token: Token,
  type: TokenTradeOrderType,
  count: number,
  price: number,
  targetAddress = '',
  ip = '',
  acceptedTokenStatuses = ACCEPTED_TOKEN_STATUSES,
) => {
  const isSell = type === TokenTradeOrderType.SELL;
  if (isProdEnv()) {
    await assertIpNotBlocked(ip, token.uid, 'token');
  }
  assertTokenApproved(token, [TokenStatus.MINTED, TokenStatus.BASE].includes(token.status));
  assertTokenStatus(token, acceptedTokenStatuses);

  const [sourceNetwork, targetNetwork] = getSourceAndTargetNetwork(token, isSell);
  const member = await database().doc(COL.MEMBER, owner).get();
  assertMemberHasValidAddress(member, sourceNetwork);
  if (targetAddress) {
    if (!targetAddress.startsWith(targetNetwork === Network.ATOI ? 'rms' : targetNetwork)) {
      throw invalidArgument(WenError.invalid_target_address);
    }
  } else {
    assertMemberHasValidAddress(member, targetNetwork);
  }

  if ([TokenStatus.BASE, TokenStatus.MINTED].includes(token.status) || !isSell) {
    const tradeOrderTransaction = await createTradeOrderTransaction(
      project,
      token,
      owner,
      sourceNetwork,
      isSell,
      Number(count),
      Number(price),
      targetAddress,
    );

    return { tradeOrderTransaction, tradeOrder: undefined, distribution: undefined };
  }

  const distributionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, owner);
  const distribution = await transaction.get(distributionDocRef);
  if (!distribution) {
    throw invalidArgument(WenError.invalid_params);
  }
  const tokensLeftForSale = (distribution.tokenOwned || 0) - (distribution.lockedForSale || 0);
  if (Number(count) > tokensLeftForSale) {
    throw invalidArgument(WenError.no_available_tokens_for_sale);
  }
  const tradeOrder: TokenTradeOrder = {
    project,
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
      lockedForSale: database().inc(Number(count)),
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
  project: string,
  token: Token,
  member: string,
  network: Network,
  isSell: boolean,
  count: number,
  price: number,
  tokenTradeOderTargetAddress = '',
): Promise<Transaction> => {
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const isMinted = token.status === TokenStatus.MINTED;

  const order: Transaction = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member,
    space: token.space || '',
    network,
    payload: {
      type: isSell ? TransactionPayloadType.SELL_TOKEN : TransactionPayloadType.BUY_TOKEN,
      amount: getAmount(token, count, price, isSell),
      nativeTokens:
        isMinted && isSell ? [{ id: token.mintingData?.tokenId!, amount: BigInt(0) }] : [],
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      chainReference: null,
      token: token.uid,
      count,
      price,
    },
    linkedTransactions: [],
  };
  if (tokenTradeOderTargetAddress) {
    set(order, 'payload.tokenTradeOderTargetAddress', tokenTradeOderTargetAddress);
  }
  return order;
};

const getPrice = async (
  transaction: ITransaction,
  params: TradeTokenTangleRequest,
  type: TokenTradeOrderType,
  token: string,
) => {
  if (params.price) {
    return params.price;
  }
  if (type === TokenTradeOrderType.SELL) {
    return MIN_PRICE_PER_TOKEN;
  }

  const snap = await database()
    .collection(COL.TOKEN_MARKET)
    .where('token', '==', token)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', 'desc')
    .limit(1)
    .get();
  const highestSell = head(snap);
  if (!highestSell) {
    throw invalidArgument(WenError.no_active_sells);
  }
  return highestSell.price;
};

const getCount = (params: TradeTokenTangleRequest, type: TokenTradeOrderType) => {
  if (type === TokenTradeOrderType.BUY) {
    return params.count || MAX_TOTAL_TOKEN_SUPPLY;
  }
  return params.count || 0;
};

const getAmount = (token: Token, count: number, price: number, isSell: boolean) => {
  if (!isSell) {
    return Number(bigDecimal.floor(bigDecimal.multiply(count, price)));
  }
  if (token.status !== TokenStatus.MINTED) {
    return count;
  }
  return 0;
};
