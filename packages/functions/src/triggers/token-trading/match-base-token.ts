import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  Entity,
  Member,
  Token,
  TokenPurchaseAge,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import { Wallet } from '../../services/wallet/wallet';
import { WalletService } from '../../services/wallet/wallet.service';
import { getAddress } from '../../utils/address.utils';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { getProject } from '../../utils/common.utils';
import { getRoyaltyFees } from '../../utils/royalty.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Match } from './match-token';
import { getMemberTier, getTokenTradingFee } from './token-trade-order.trigger';

const createIotaPayments = async (
  token: Token,
  sell: TokenTradeOrder,
  buy: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  count: number,
): Promise<Transaction[]> => {
  const balance = sell.balance - count;
  const wallet = await WalletService.newWallet(sell.sourceNetwork!);
  const tmpAddress = await wallet.getNewIotaAddressDetails(false);
  const remainder = await packBasicOutput(wallet, tmpAddress.bech32, balance, {});
  if (balance !== 0 && balance < Number(remainder.amount)) {
    return [];
  }
  const sellOrder = await build5Db().doc(COL.TRANSACTION, sell.orderTransactionId!).get();
  const billPayment: Transaction = {
    project: getProject(sell),
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: sell.owner,
    space: token.space,
    network: sell.sourceNetwork!,
    payload: {
      type: TransactionPayloadType.BASE_TOKEN_TRADE,
      amount: count,
      sourceAddress: sellOrder!.payload.targetAddress,
      targetAddress: buy.targetAddress || getAddress(buyer, sell.sourceNetwork!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: seller.uid,
      ownerEntity: Entity.MEMBER,
      owner: buyer.uid,
      sourceTransaction: [sell.paymentTransactionId || ''],
      royalty: false,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  if (sell.fulfilled + count < sell.count || !balance) {
    return [billPayment];
  }
  const credit: Transaction = {
    project: getProject(sell),
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    member: sell.owner,
    network: sell.sourceNetwork!,
    space: token.space,
    payload: {
      type: TransactionPayloadType.TOKEN_TRADE_FULLFILLMENT,
      dependsOnBillPayment: true,
      amount: balance,
      sourceAddress: sellOrder!.payload.targetAddress,
      targetAddress: getAddress(seller, sell.sourceNetwork!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: seller.uid,
      ownerEntity: Entity.MEMBER,
      owner: seller.uid,
      sourceTransaction: [sell.paymentTransactionId || ''],
      royalty: false,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  return [billPayment, credit];
};

const createRoyaltyPayment = async (
  wallet: Wallet,
  token: Token,
  sell: TokenTradeOrder,
  buy: TokenTradeOrder,
  buyOrder: Transaction,
  seller: Member,
  spaceId: string,
  fee: number,
) => {
  const space = (await build5Db().doc(COL.SPACE, spaceId).get())!;
  const spaceAddress = getAddress(space, buy.sourceNetwork!);
  const sellerAddress = getAddress(seller, buy.sourceNetwork!);
  const output = await packBasicOutput(wallet, spaceAddress, 0, {
    storageDepositReturnAddress: sellerAddress,
  });
  return <Transaction>{
    project: getProject(sell),
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: spaceId,
    member: buy.owner,
    network: buy.sourceNetwork!,
    payload: {
      type: TransactionPayloadType.BASE_TOKEN_TRADE,
      amount: Number(output.amount) + fee,
      storageReturn: {
        amount: Number(output.amount),
        address: sellerAddress,
      },
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: spaceAddress,
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buy.owner,
      ownerEntity: Entity.SPACE,
      owner: spaceId,
      sourceTransaction: [buy.paymentTransactionId || ''],
      royalty: true,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
};

const createSmrPayments = async (
  token: Token,
  sell: TokenTradeOrder,
  buy: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  tokensToTrade: number,
  price: number,
): Promise<Transaction[]> => {
  const wallet = await WalletService.newWallet(buy.sourceNetwork!);
  const tmpAddress = await wallet.getNewIotaAddressDetails(false);
  const buyOrder = await build5Db().doc(COL.TRANSACTION, buy.orderTransactionId!).get();

  let salePrice = Number(bigDecimal.floor(bigDecimal.multiply(price, tokensToTrade)));
  let balanceLeft = buy.balance - salePrice;
  const fulfilled = buy.fulfilled + tokensToTrade === buy.count || balanceLeft === 0;

  if (balanceLeft < 0) {
    return [];
  }

  const royaltyFees = await getRoyaltyFees(salePrice, seller.tokenTradingFeePercentage);
  const remainder = await packBasicOutput(wallet, tmpAddress.bech32, balanceLeft, {});
  if (balanceLeft > 0 && balanceLeft < Number(remainder.amount)) {
    if (!fulfilled) {
      return [];
    }
    royaltyFees[Object.keys(royaltyFees)[0]] += balanceLeft;
    salePrice += balanceLeft;
    balanceLeft = 0;
  }

  const royaltyPaymentPromises = Object.entries(royaltyFees)
    .filter((entry) => entry[1] > 0)
    .map(([space, fee]) =>
      createRoyaltyPayment(wallet, token, sell, buy, buyOrder!, seller, space, fee),
    );
  const royaltyPayments = await Promise.all(royaltyPaymentPromises);
  royaltyPayments.forEach((rp) => {
    salePrice -= rp.payload.amount!;
  });

  const billPaymentOutput = await packBasicOutput(wallet, tmpAddress.bech32, salePrice, {});
  if (salePrice < Number(billPaymentOutput.amount)) {
    return [];
  }

  const billPayment: Transaction = {
    project: getProject(sell),
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    space: token.space,
    network: buy.sourceNetwork!,
    payload: {
      type: TransactionPayloadType.BASE_TOKEN_TRADE,
      amount: salePrice,
      sourceAddress: buyOrder!.payload.targetAddress,
      targetAddress: sell.targetAddress || getAddress(seller, buy.sourceNetwork!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buy.owner,
      ownerEntity: Entity.MEMBER,
      owner: sell.owner,
      sourceTransaction: [buy.paymentTransactionId || ''],
      royalty: false,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };

  if (!fulfilled || !balanceLeft) {
    return [...royaltyPayments, billPayment];
  }
  const credit: Transaction = {
    project: getProject(buy),
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    network: buy.sourceNetwork!,
    space: token.space,
    payload: {
      type: TransactionPayloadType.TOKEN_TRADE_FULLFILLMENT,
      dependsOnBillPayment: true,
      amount: balanceLeft,
      sourceAddress: buyOrder!.payload.targetAddress,
      targetAddress: getAddress(buyer, buy.sourceNetwork!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buy.owner,
      ownerEntity: Entity.MEMBER,
      owner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId || ''],
      royalty: false,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  return [...royaltyPayments, billPayment, credit];
};

export const matchBaseToken = async (
  transaction: ITransaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
): Promise<Match> => {
  const tokensToTrade = Math.min(
    sell.count - sell.fulfilled,
    buy.count - buy.fulfilled,
    Math.floor(buy.balance / price),
  );
  const seller = await build5Db().doc(COL.MEMBER, sell.owner).get();
  const buyer = await build5Db().doc(COL.MEMBER, buy.owner).get();

  const iotaPayments = await createIotaPayments(token, sell, buy, seller!, buyer!, tokensToTrade);
  const smrPayments = await createSmrPayments(
    token,
    sell,
    buy,
    seller!,
    buyer!,
    tokensToTrade,
    price,
  );
  if (isEmpty(iotaPayments) || isEmpty(smrPayments)) {
    return { sellerCreditId: undefined, buyerCreditId: undefined, purchase: undefined };
  }
  for (const payment of iotaPayments) {
    const docRef = build5Db().doc(COL.TRANSACTION, payment.uid);
    await transaction.create(docRef, payment);
  }
  for (const payment of smrPayments) {
    const docRef = build5Db().doc(COL.TRANSACTION, payment.uid);
    await transaction.create(docRef, payment);
  }
  return {
    sellerCreditId: iotaPayments.find((o) => o.type === TransactionType.CREDIT)?.uid,
    buyerCreditId: smrPayments.find((o) => o.type === TransactionType.CREDIT)?.uid,
    purchase: {
      project: getProject(triggeredBy === TokenTradeOrderType.SELL ? sell : buy),
      uid: getRandomEthAddress(),
      token: buy.token,
      tokenStatus: token.status,
      sell: sell.uid,
      buy: buy.uid,
      count: tokensToTrade,
      price,
      sourceNetwork: sell.sourceNetwork,
      targetNetwork: sell.targetNetwork,
      triggeredBy,
      billPaymentId: iotaPayments.filter((o) => o.type === TransactionType.BILL_PAYMENT)[0].uid,
      buyerBillPaymentId: smrPayments.filter(
        (o) => o.type === TransactionType.BILL_PAYMENT && o.payload.royalty === false,
      )[0].uid,
      royaltyBillPayments: smrPayments
        .filter((o) => o.type === TransactionType.BILL_PAYMENT && o.payload.royalty === true)
        .map((o) => o.uid),

      sellerTier: await getMemberTier(getProject(sell), seller!),
      sellerTokenTradingFeePercentage: getTokenTradingFee(seller!) as number,

      age: Object.values(TokenPurchaseAge),
    },
  };
};
