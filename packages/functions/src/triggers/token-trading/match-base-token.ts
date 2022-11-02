import { INodeInfo } from '@iota/iota.js-next';

import {
  COL,
  Entity,
  Member,
  MIN_IOTA_AMOUNT,
  Space,
  Token,
  TokenPurchase,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  URL_PATHS,
} from '@soonaverse/interfaces';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import admin from '../../admin.config';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { getAddress } from '../../utils/address.utils';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { cOn } from '../../utils/dateTime.utils';
import { getRoyaltyFees } from '../../utils/royalty.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Match } from './match-token';

const createIotaPayments = async (
  token: Token,
  sell: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  count: number,
): Promise<Transaction[]> => {
  if (count < MIN_IOTA_AMOUNT) {
    return [];
  }
  const balance = sell.balance - count;
  if (balance !== 0 && balance < MIN_IOTA_AMOUNT) {
    return [];
  }
  const sellOrder = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()
  );
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: sell.owner,
    space: token.space,
    network: sell.sourceNetwork!,
    payload: {
      amount: count,
      sourceAddress: sellOrder.payload.targetAddress,
      targetAddress: getAddress(buyer, sell.sourceNetwork!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: seller.uid,
      ownerEntity: Entity.MEMBER,
      owner: buyer.uid,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
    },
  };
  if (sell.fulfilled + count < sell.count || !balance) {
    return [billPayment];
  }
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    member: sell.owner,
    network: sell.sourceNetwork,
    space: token.space,
    payload: {
      dependsOnBillPayment: true,
      amount: balance,
      sourceAddress: sellOrder.payload.targetAddress,
      targetAddress: getAddress(seller, sell.sourceNetwork!),
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
  return [billPayment, credit];
};

const createRoyaltyPayment = async (
  buy: TokenTradeOrder,
  buyOrder: Transaction,
  seller: Member,
  spaceId: string,
  fee: number,
  info: INodeInfo,
) => {
  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${spaceId}`).get()).data();
  const spaceAddress = getAddress(space, buy.sourceNetwork!);
  const sellerAddress = getAddress(seller, buy.sourceNetwork!);
  const output = packBasicOutput(spaceAddress, 0, undefined, info, sellerAddress);
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: spaceId,
    member: buy.owner,
    network: buy.sourceNetwork,
    payload: {
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
      sourceTransaction: [buy.paymentTransactionId],
      royalty: true,
      void: false,
      token: buy.token,
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
  const wallet = (await WalletService.newWallet(buy.sourceNetwork!)) as SmrWallet;
  const tmpAddress = await wallet.getNewIotaAddressDetails(false);
  const buyOrder = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  );

  const fulfilled = buy.fulfilled + tokensToTrade === buy.count;
  let salePrice = Number(bigDecimal.floor(bigDecimal.multiply(price, tokensToTrade)));
  let balanceLeft = buy.balance - salePrice;

  if (balanceLeft < 0) {
    return [];
  }

  const royaltyFees = await getRoyaltyFees(salePrice, seller.tokenTradingFeePercentage);
  const remainder = packBasicOutput(tmpAddress.bech32, balanceLeft, undefined, wallet.info);
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
    .map(([space, fee]) => createRoyaltyPayment(buy, buyOrder, seller, space, fee, wallet.info));
  const royaltyPayments = await Promise.all(royaltyPaymentPromises);
  royaltyPayments.forEach((rp) => {
    salePrice -= rp.payload.amount;
  });

  const billPaymentOutput = packBasicOutput(tmpAddress.bech32, salePrice, undefined, wallet.info);
  if (salePrice < Number(billPaymentOutput.amount)) {
    return [];
  }

  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    space: token.space,
    network: buy.sourceNetwork!,
    payload: {
      amount: salePrice,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(seller, buy.sourceNetwork!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buy.owner,
      ownerEntity: Entity.MEMBER,
      owner: sell.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
    },
  };

  if (!fulfilled || !balanceLeft) {
    return [...royaltyPayments, billPayment];
  }
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    network: buy.sourceNetwork,
    space: token.space,
    payload: {
      dependsOnBillPayment: true,
      amount: balanceLeft,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(buyer, buy.sourceNetwork!),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buy.owner,
      ownerEntity: Entity.MEMBER,
      owner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
    },
  };
  return [...royaltyPayments, billPayment, credit];
};

export const matchBaseToken = async (
  transaction: admin.firestore.Transaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
): Promise<Match> => {
  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data();
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data();

  const iotaPayments = await createIotaPayments(token, sell, seller, buyer, tokensToTrade);
  const smrPayments = await createSmrPayments(
    token,
    sell,
    buy,
    seller,
    buyer,
    tokensToTrade,
    price,
  );
  if (isEmpty(iotaPayments) || isEmpty(smrPayments)) {
    return { sellerCreditId: undefined, buyerCreditId: undefined, purchase: undefined };
  }
  [...iotaPayments, ...smrPayments].forEach((payment) => {
    const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${payment.uid}`);
    transaction.create(docRef, cOn(payment, URL_PATHS.TRANSACTION));
  });
  return {
    sellerCreditId: iotaPayments.find((o) => o.type === TransactionType.CREDIT)?.uid,
    buyerCreditId: smrPayments.find((o) => o.type === TransactionType.CREDIT)?.uid,
    purchase: <TokenPurchase>{
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
    },
  };
};
