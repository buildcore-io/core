import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  Entity,
  Member,
  Space,
  Token,
  TokenPurchaseAge,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import bigDecimal from 'js-big-decimal';
import { Wallet } from '../../services/wallet/wallet';
import { WalletService } from '../../services/wallet/wallet.service';
import { getAddress } from '../../utils/address.utils';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { getProject } from '../../utils/common.utils';
import { getRoyaltyFees } from '../../utils/royalty.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Match } from './match-token';
import { getMemberTier, getTokenTradingFee } from './token-trade-order.trigger';

const createRoyaltyBillPayments = async (
  wallet: Wallet,
  token: Token,
  buy: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  buyOrderTran: Transaction,
  sellPrice: number,
  dust: number,
) => {
  const royaltyFees = await getRoyaltyFees(sellPrice - dust, seller.tokenTradingFeePercentage);
  royaltyFees[Object.keys(royaltyFees)[0]] += dust;

  const promises = Object.entries(royaltyFees)
    .filter((entry) => entry[1] > 0)
    .map(async ([spaceId, fee]): Promise<Transaction> => {
      const space = await build5Db().doc(`${COL.SPACE}/${spaceId}`).get<Space>();
      const spaceAddress = getAddress(space, token.mintingData?.network!);
      const sellerAddress = getAddress(seller, token.mintingData?.network!);
      const output = await packBasicOutput(wallet, spaceAddress, 0, {
        storageDepositReturnAddress: sellerAddress,
      });
      return <Transaction>{
        project: getProject(buy),
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: spaceId,
        member: buyer.uid,
        network: token.mintingData?.network!,
        payload: {
          type: TransactionPayloadType.MINTED_TOKEN_TRADE,
          amount: Number(output.amount) + fee,
          storageReturn: {
            amount: Number(output.amount),
            address: sellerAddress,
          },
          sourceAddress: buyOrderTran.payload.targetAddress,
          targetAddress: spaceAddress,
          previousOwnerEntity: Entity.MEMBER,
          previousOwner: buyer.uid,
          ownerEntity: Entity.SPACE,
          owner: spaceId,
          sourceTransaction: [buy.paymentTransactionId || ''],
          royalty: true,
          void: false,
          token: token.uid,
          tokenSymbol: token.symbol,
        },
      };
    });

  return await Promise.all(promises);
};

const createBillPaymentToSeller = async (
  wallet: Wallet,
  token: Token,
  buyer: Member,
  seller: Member,
  buyOrderTran: Transaction,
  sell: TokenTradeOrder,
  buy: TokenTradeOrder,
  salePrice: number,
) => {
  const network = token.mintingData?.network!;
  const sellerAddress = sell.targetAddress || getAddress(seller, network);
  const output = await packBasicOutput(wallet, sellerAddress, salePrice, {});
  return <Transaction>{
    project: getProject(sell),
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buyer.uid,
    network,
    payload: {
      type: TransactionPayloadType.MINTED_TOKEN_TRADE,
      amount: Number(output.amount),
      sourceAddress: buyOrderTran.payload.targetAddress,
      targetAddress: sellerAddress,
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buyer.uid,
      ownerEntity: Entity.MEMBER,
      owner: seller.uid,
      sourceTransaction: [buy.paymentTransactionId || ''],
      royalty: false,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
};

const createBillPaymentWithNativeTokens = async (
  wallet: Wallet,
  token: Token,
  buyer: Member,
  seller: Member,
  buyOrderTran: Transaction,
  sellOrderTran: Transaction,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  tokensToSell: number,
): Promise<Transaction> => {
  const network = token.mintingData?.network!;
  const sellerAddress = getAddress(seller, network);
  const buyerAddress = buy.targetAddress || getAddress(buyer, network);
  const output = await packBasicOutput(wallet, buyerAddress, 0, {
    nativeTokens: [{ id: token.mintingData?.tokenId!, amount: BigInt(tokensToSell) }],
    storageDepositReturnAddress: sellerAddress,
  });
  return {
    project: getProject(sell),
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    network,
    payload: {
      type: TransactionPayloadType.MINTED_TOKEN_TRADE,
      amount: Number(output.amount),
      nativeTokens: [{ id: token.mintingData?.tokenId!, amount: BigInt(tokensToSell) }],
      sourceAddress: sellOrderTran.payload.targetAddress,
      storageDepositSourceAddress: buyOrderTran.payload.targetAddress,
      storageReturn: {
        amount: Number(output.amount),
        address: sellerAddress,
      },
      targetAddress: buyerAddress,
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: seller.uid,
      ownerEntity: Entity.MEMBER,
      owner: buyer.uid,
      sourceTransaction: [sell.paymentTransactionId!, buy.paymentTransactionId!],
      royalty: false,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
};

const createCreditToSeller = (
  token: Token,
  seller: Member,
  sell: TokenTradeOrder,
  buy: TokenTradeOrder,
  sellOrderTran: Transaction,
) =>
  <Transaction>{
    project: getProject(sell),
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    network: token.mintingData?.network!,
    payload: {
      type: TransactionPayloadType.TOKEN_TRADE_FULLFILLMENT,
      dependsOnBillPayment: true,
      amount: sellOrderTran.payload.amount,
      sourceAddress: sellOrderTran.payload.targetAddress,
      targetAddress: getAddress(seller, token.mintingData?.network!),
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

const createCreditToBuyer = (
  token: Token,
  buyer: Member,
  buy: TokenTradeOrder,
  buyOrderTran: Transaction,
  amount: number,
) =>
  <Transaction>{
    project: getProject(buy),
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buyer.uid,
    network: token.mintingData?.network!,
    payload: {
      type: TransactionPayloadType.TOKEN_TRADE_FULLFILLMENT,
      dependsOnBillPayment: true,
      amount,
      sourceAddress: buyOrderTran.payload.targetAddress,
      targetAddress: getAddress(buyer, token.mintingData?.network!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buyer.uid,
      ownerEntity: Entity.MEMBER,
      owner: buyer.uid,
      sourceTransaction: [buy.paymentTransactionId || ''],
      royalty: false,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };

export const matchMintedToken = async (
  transaction: ITransaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
): Promise<Match> => {
  const wallet = await WalletService.newWallet(token.mintingData?.network!);

  const seller = (await build5Db().doc(`${COL.MEMBER}/${sell.owner}`).get<Member>())!;
  const buyer = (await build5Db().doc(`${COL.MEMBER}/${buy.owner}`).get<Member>())!;

  const buyOrderTran = (await build5Db()
    .doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`)
    .get<Transaction>())!;
  const sellOrderTran = (await build5Db()
    .doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`)
    .get<Transaction>())!;

  const tokensToTrade = Math.min(
    sell.count - sell.fulfilled,
    buy.count - buy.fulfilled,
    Math.floor(buy.balance / price),
  );
  let salePrice = Number(bigDecimal.floor(bigDecimal.multiply(price, tokensToTrade)));
  let balanceLeft = buy.balance - salePrice;
  const buyIsFulfilled = buy.fulfilled + tokensToTrade === buy.count || balanceLeft === 0;

  if (balanceLeft < 0) {
    return { purchase: undefined, sellerCreditId: undefined, buyerCreditId: undefined };
  }

  const buyerAddress = getAddress(buyer, token.mintingData?.network!);
  const remainder = await packBasicOutput(wallet, buyerAddress, balanceLeft, {});
  let dust = 0;
  if (balanceLeft > 0 && balanceLeft < Number(remainder.amount)) {
    if (!buyIsFulfilled) {
      return { purchase: undefined, sellerCreditId: undefined, buyerCreditId: undefined };
    }
    dust = balanceLeft;
    salePrice += balanceLeft;
    balanceLeft = 0;
  }

  const royaltyBillPayments = await createRoyaltyBillPayments(
    wallet,
    token,
    buy,
    seller,
    buyer,
    buyOrderTran,
    salePrice,
    dust,
  );
  royaltyBillPayments.forEach((o) => {
    salePrice -= o.payload.amount!;
  });

  const billPaymentWithNativeTokens = await createBillPaymentWithNativeTokens(
    wallet,
    token,
    buyer,
    seller,
    buyOrderTran,
    sellOrderTran,
    buy,
    sell,
    tokensToTrade,
  );
  salePrice -= billPaymentWithNativeTokens.payload.amount!;

  const billPaymentToSeller = await createBillPaymentToSeller(
    wallet,
    token,
    buyer,
    seller,
    buyOrderTran,
    sell,
    buy,
    salePrice,
  );
  salePrice -= billPaymentToSeller.payload.amount!;

  if (salePrice !== 0) {
    return { purchase: undefined, sellerCreditId: undefined, buyerCreditId: undefined };
  }

  const creditToSeller =
    sell.fulfilled + tokensToTrade === sell.count
      ? createCreditToSeller(token, seller, sell, buy, sellOrderTran)
      : undefined;

  const creditToBuyer =
    buyIsFulfilled && balanceLeft
      ? createCreditToBuyer(token, buyer, buy, buyOrderTran, balanceLeft)
      : undefined;

  [
    ...royaltyBillPayments,
    billPaymentToSeller,
    billPaymentWithNativeTokens,
    creditToSeller,
    creditToBuyer,
  ]
    .filter((t) => t !== undefined)
    .forEach((data) => {
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${data!.uid}`);
      transaction.create(docRef, data!);
    });

  return {
    purchase: {
      project: getProject(triggeredBy === TokenTradeOrderType.SELL ? sell : buy),
      uid: getRandomEthAddress(),
      token: buy.token,
      tokenStatus: token.status,
      sell: sell.uid,
      buy: buy.uid,
      count: tokensToTrade,
      price,
      triggeredBy,
      billPaymentId: billPaymentWithNativeTokens.uid,
      buyerBillPaymentId: billPaymentToSeller.uid,
      royaltyBillPayments: royaltyBillPayments.map((o) => o.uid),

      sellerTier: await getMemberTier(getProject(sell), seller),
      sellerTokenTradingFeePercentage: getTokenTradingFee(seller) as number,
      age: Object.values(TokenPurchaseAge),
    },
    sellerCreditId: creditToSeller?.uid,
    buyerCreditId: creditToBuyer?.uid,
  };
};
