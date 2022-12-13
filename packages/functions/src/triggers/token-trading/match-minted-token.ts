import { INodeInfo } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  Entity,
  Member,
  Space,
  Token,
  TokenPurchase,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import bigDecimal from 'js-big-decimal';
import admin from '../../admin.config';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { getAddress } from '../../utils/address.utils';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { cOn } from '../../utils/dateTime.utils';
import { getRoyaltyFees } from '../../utils/royalty.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Match } from './match-token';

const createRoyaltyBillPayments = async (
  token: Token,
  buy: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  buyOrderTran: Transaction,
  sellPrice: number,
  dust: number,
  info: INodeInfo,
) => {
  const royaltyFees = await getRoyaltyFees(sellPrice - dust, seller.tokenTradingFeePercentage);
  royaltyFees[Object.keys(royaltyFees)[0]] += dust;

  const promises = Object.entries(royaltyFees)
    .filter((entry) => entry[1] > 0)
    .map(async ([spaceId, fee]) => {
      const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${spaceId}`).get()).data();
      const spaceAddress = getAddress(space, token.mintingData?.network!);
      const sellerAddress = getAddress(seller, token.mintingData?.network!);
      const output = packBasicOutput(spaceAddress, 0, undefined, info, sellerAddress);
      return <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: spaceId,
        member: buyer.uid,
        network: token.mintingData?.network!,
        payload: {
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
          sourceTransaction: [buy.paymentTransactionId],
          royalty: true,
          void: false,
          token: token.uid,
        },
      };
    });

  return await Promise.all(promises);
};

const createBillPaymentToSeller = (
  token: Token,
  buyer: Member,
  seller: Member,
  buyOrderTran: Transaction,
  buy: TokenTradeOrder,
  salePrice: number,
  info: INodeInfo,
) => {
  const sellerAddress = getAddress(seller, token.mintingData?.network!);
  const output = packBasicOutput(sellerAddress, salePrice, undefined, info);
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buyer.uid,
    network: token.mintingData?.network!,
    payload: {
      amount: Number(output.amount),
      sourceAddress: buyOrderTran.payload.targetAddress,
      targetAddress: sellerAddress,
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buyer.uid,
      ownerEntity: Entity.MEMBER,
      owner: seller.uid,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
    },
  };
};

const createBillPaymentWithNativeTokens = (
  token: Token,
  buyer: Member,
  seller: Member,
  buyOrderTran: Transaction,
  sellOrderTran: Transaction,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  tokensToSell: number,
  info: INodeInfo,
) => {
  const sellerAddress = getAddress(seller, token.mintingData?.network!);
  const buyerAddress = getAddress(buyer, token.mintingData?.network!);
  const output = packBasicOutput(
    buyerAddress,
    0,
    [{ id: token.mintingData?.tokenId!, amount: HexHelper.fromBigInt256(bigInt(tokensToSell)) }],
    info,
    sellerAddress,
  );
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    network: token.mintingData?.network!,
    payload: {
      amount: Number(output.amount),
      nativeTokens: [{ id: token.mintingData?.tokenId!, amount: tokensToSell }],
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
      sourceTransaction: [sell.paymentTransactionId, buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
    },
  };
};

const createCreditToSeller = (
  token: Token,
  seller: Member,
  sell: TokenTradeOrder,
  sellOrderTran: Transaction,
) => {
  const sellerAddress = getAddress(seller, token.mintingData?.network!);
  return <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    network: token.mintingData?.network!,
    payload: {
      dependsOnBillPayment: true,
      amount: sellOrderTran.payload.amount,
      sourceAddress: sellOrderTran.payload.targetAddress,
      targetAddress: sellerAddress,
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: seller.uid,
      ownerEntity: Entity.MEMBER,
      owner: seller.uid,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
    },
  };
};

const createCreditToBuyer = (
  token: Token,
  buyer: Member,
  buy: TokenTradeOrder,
  buyOrderTran: Transaction,
  amount: number,
) => {
  const buyerAddress = getAddress(buyer, token.mintingData?.network!);
  return <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buyer.uid,
    network: token.mintingData?.network!,
    payload: {
      dependsOnBillPayment: true,
      amount,
      sourceAddress: buyOrderTran.payload.targetAddress,
      targetAddress: buyerAddress,
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buyer.uid,
      ownerEntity: Entity.MEMBER,
      owner: buyer.uid,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
    },
  };
};

export const matchMintedToken = async (
  transaction: admin.firestore.Transaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
): Promise<Match> => {
  const wallet = (await WalletService.newWallet(token.mintingData?.network!)) as SmrWallet;

  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data();
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data();

  const buyOrderTran = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  );
  const sellOrderTran = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()
  );

  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);
  const buyIsFulfilled = buy.fulfilled + tokensToTrade === buy.count;
  let salePrice = Number(bigDecimal.floor(bigDecimal.multiply(price, tokensToTrade)));
  let balanceLeft = buy.balance - salePrice;

  if (balanceLeft < 0) {
    return { purchase: undefined, sellerCreditId: undefined, buyerCreditId: undefined };
  }

  const buyerAddress = getAddress(buyer, token.mintingData?.network!);
  const remainder = packBasicOutput(buyerAddress, balanceLeft, undefined, wallet.info);
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
    token,
    buy,
    seller,
    buyer,
    buyOrderTran,
    salePrice,
    dust,
    wallet.info,
  );
  royaltyBillPayments.forEach((o) => {
    salePrice -= o.payload.amount;
  });

  const billPaymentWithNativeTokens = createBillPaymentWithNativeTokens(
    token,
    buyer,
    seller,
    buyOrderTran,
    sellOrderTran,
    buy,
    sell,
    tokensToTrade,
    wallet.info,
  );
  salePrice -= billPaymentWithNativeTokens.payload.amount;

  const billPaymentToSeller = createBillPaymentToSeller(
    token,
    buyer,
    seller,
    buyOrderTran,
    buy,
    salePrice,
    wallet.info,
  );
  salePrice -= billPaymentToSeller.payload.amount;

  if (salePrice !== 0) {
    return { purchase: undefined, sellerCreditId: undefined, buyerCreditId: undefined };
  }

  const creditToSeller =
    sell.fulfilled + tokensToTrade === sell.count
      ? createCreditToSeller(token, seller, sell, sellOrderTran)
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
    .forEach((data) =>
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data!.uid}`), cOn(data!)),
    );

  return {
    purchase: <TokenPurchase>{
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
    },
    sellerCreditId: creditToSeller?.uid,
    buyerCreditId: creditToBuyer?.uid,
  };
};
