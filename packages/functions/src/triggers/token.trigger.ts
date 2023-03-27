import {
  BillPaymentType,
  COL,
  DEFAULT_NETWORK,
  Entity,
  MediaStatus,
  Member,
  MIN_IOTA_AMOUNT,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  Transaction,
  TransactionCreditType,
  TransactionMintTokenType,
  TransactionType,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import admin from '../admin.config';
import { FirestoreTransaction } from '../database/wrapper/firestore';
import { scale } from '../scale.settings';
import { WalletService } from '../services/wallet/wallet';
import { getAddress } from '../utils/address.utils';
import { downloadMediaAndPackCar, tokenToIpfsMetadata } from '../utils/car.utils';
import { guardedRerun } from '../utils/common.utils';
import { cOn, uOn } from '../utils/dateTime.utils';
import { getRoyaltyFees } from '../utils/royalty.utils';
import { cancelTradeOrderUtil } from '../utils/token-trade.utils';
import {
  allPaymentsQuery,
  BIG_DECIMAL_PRECISION,
  getTotalPublicSupply,
  memberDocRef,
  orderDocRef,
} from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const onTokenStatusUpdate = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '4GB',
    minInstances: scale(WEN_FUNC.onTokenStatusUpdate),
  })
  .firestore.document(COL.TOKEN + '/{tokenId}')
  .onUpdate(async (change) => {
    const prev = <Token | undefined>change.before.data();
    const curr = <Token | undefined>change.after.data();

    if (prev?.status === TokenStatus.AVAILABLE && curr?.status === TokenStatus.PROCESSING) {
      return await processTokenDistribution(curr!);
    }

    if (prev?.status !== curr?.status && curr?.status === TokenStatus.CANCEL_SALE) {
      return await cancelPublicSale(curr!);
    }

    if (prev?.status !== curr?.status && curr?.status === TokenStatus.MINTING) {
      return await mintToken(curr);
    }

    if (prev?.mintingData?.tokensInVault && curr?.mintingData?.tokensInVault === 0) {
      await onTokenVaultEmptied(curr);
    }
  });

const getTokenCount = (token: Token, amount: number) => Math.floor(amount / token.pricePerToken);

const getBoughtByMember = (
  token: Token,
  totalDeposit: number,
  totalSupply: number,
  totalBought: number,
) => {
  const boughtByMember = bigDecimal.floor(
    bigDecimal.divide(totalDeposit, token.pricePerToken, BIG_DECIMAL_PRECISION),
  );
  const percentageBought = bigDecimal.divide(
    bigDecimal.multiply(boughtByMember, 100),
    Math.max(totalSupply, totalBought),
    BIG_DECIMAL_PRECISION,
  );
  const total = bigDecimal.floor(
    bigDecimal.divide(
      bigDecimal.multiply(totalSupply, percentageBought),
      100,
      BIG_DECIMAL_PRECISION,
    ),
  );
  return Number(total);
};

const getTotalPaid = (pricePerToken: number, boughtByMember: number) => {
  const totalPaid = Number(bigDecimal.multiply(pricePerToken, boughtByMember));
  return totalPaid < MIN_IOTA_AMOUNT ? 0 : totalPaid;
};

const getMemberDistribution = (
  distribution: TokenDistribution,
  token: Token,
  totalSupply: number,
  totalBought: number,
): TokenDistribution => {
  const totalDeposit = distribution.totalDeposit || 0;
  const boughtByMember = getBoughtByMember(token, totalDeposit, totalSupply, totalBought);
  const totalPaid = getTotalPaid(token.pricePerToken, boughtByMember);
  const refundedAmount = Number(bigDecimal.subtract(totalDeposit, totalPaid));
  return <TokenDistribution>{
    uid: distribution.uid,
    totalDeposit: distribution.totalDeposit || 0,
    totalPaid,
    refundedAmount,
    totalBought: boughtByMember,
    reconciled: distribution.reconciled || false,
  };
};

const getFlooredDistribution = (distribution: TokenDistribution): TokenDistribution => {
  const totalPaid = Math.floor(distribution.totalPaid!);
  const refundedAmount = Number(bigDecimal.subtract(distribution.totalDeposit!, totalPaid));
  return { ...distribution, totalPaid, refundedAmount };
};

const createBillAndRoyaltyPayment = async (
  token: Token,
  distribution: TokenDistribution,
  payments: Transaction[],
  order: Transaction,
  space: Space,
  batch: admin.firestore.WriteBatch,
) => {
  if (!distribution.totalPaid) {
    return { billPaymentId: '', royaltyBillPaymentId: '' };
  }
  let balance =
    distribution.totalPaid +
    (distribution.refundedAmount! < MIN_IOTA_AMOUNT ? distribution.refundedAmount! : 0);
  const member = <Member>(await memberDocRef(distribution.uid!).get()).data();
  const [royaltySpaceId, fee] = Object.entries(
    await getRoyaltyFees(balance, member.tokenPurchaseFeePercentage, true),
  )[0];

  let royaltyPayment: Transaction | undefined = undefined;
  if (fee >= MIN_IOTA_AMOUNT && balance - fee >= MIN_IOTA_AMOUNT) {
    const royaltySpace = <Space>(
      (await admin.firestore().doc(`${COL.SPACE}/${royaltySpaceId}`).get()).data()
    );
    const network = order.network || DEFAULT_NETWORK;
    royaltyPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: distribution.uid,
      network,
      payload: {
        type: BillPaymentType.TOKEN_PURCHASE,
        amount: fee,
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(royaltySpace, network),
        previousOwnerEntity: Entity.MEMBER,
        previousOwner: distribution.uid,
        ownerEntity: Entity.SPACE,
        owner: royaltySpaceId,
        sourceTransaction: payments.map((d) => d.uid),
        reconciled: false,
        royalty: true,
        void: false,
        token: token.uid,
        tokenSymbol: token.symbol,
      },
    };
    batch.create(
      admin.firestore().collection(COL.TRANSACTION).doc(royaltyPayment.uid),
      cOn(royaltyPayment),
    );
    balance -= fee;
  }
  const network = order.network || DEFAULT_NETWORK;
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: distribution.uid,
    network,
    payload: {
      type: BillPaymentType.TOKEN_PURCHASE,
      amount: balance,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(space, network),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: distribution.uid,
      ownerEntity: Entity.SPACE,
      owner: token.space,
      sourceTransaction: payments.map((d) => d.uid),
      reconciled: false,
      royalty: false,
      void: false,
      quantity: distribution.totalBought || 0,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  batch.create(
    admin.firestore().collection(COL.TRANSACTION).doc(billPayment.uid),
    cOn(billPayment),
  );
  return { billPaymentId: billPayment.uid, royaltyBillPaymentId: royaltyPayment?.uid || '' };
};

const createCredit = async (
  token: Token,
  distribution: TokenDistribution,
  payments: Transaction[],
  order: Transaction,
  batch: admin.firestore.WriteBatch,
) => {
  if (!distribution.refundedAmount) {
    return '';
  }
  const member = <Member>(await memberDocRef(distribution.uid!).get()).data();
  const tranId = getRandomEthAddress();
  const docRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
  const network = order.network || DEFAULT_NETWORK;
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: member.uid,
    network,
    payload: {
      dependsOnBillPayment: true,
      type: TransactionCreditType.TOKEN_PURCHASE,
      amount: distribution.refundedAmount,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, network),
      sourceTransaction: payments.map((d) => d.uid),
      reconciled: true,
      void: false,
      invalidPayment: distribution.refundedAmount! < MIN_IOTA_AMOUNT,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
    ignoreWallet: distribution.refundedAmount! < MIN_IOTA_AMOUNT,
  };
  batch.create(docRef, cOn(data));
  return tranId;
};

const reconcileBuyer = (token: Token) => async (distribution: TokenDistribution) => {
  const batch = admin.firestore().batch();
  const distributionDoc = admin
    .firestore()
    .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${distribution.uid}`);

  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data();

  const order = <Transaction>(await orderDocRef(distribution.uid!, token).get()).data();
  const payments = (await allPaymentsQuery(distribution.uid!, token.uid).get()).docs.map(
    (d) => <Transaction>d.data(),
  );

  const { billPaymentId, royaltyBillPaymentId } = await createBillAndRoyaltyPayment(
    token,
    getFlooredDistribution(distribution),
    payments,
    order,
    space,
    batch,
  );
  const creditPaymentId = await createCredit(
    token,
    getFlooredDistribution(distribution),
    payments,
    order,
    batch,
  );

  batch.update(
    distributionDoc,
    uOn({
      ...distribution,
      tokenOwned: admin.firestore.FieldValue.increment(distribution.totalBought || 0),
      reconciled: true,
      billPaymentId,
      royaltyBillPaymentId,
      creditPaymentId,
    }),
  );
  await batch.commit();
};

const distributeLeftoverTokens = (
  distributions: TokenDistribution[],
  totalPublicSupply: number,
  token: Token,
) => {
  let tokensLeft = totalPublicSupply - distributions.reduce((sum, p) => sum + p.totalBought!, 0);
  let i = 0;
  let sell = false;
  while (tokensLeft) {
    const distribution = { ...distributions[i] };
    if (distribution.refundedAmount! >= token.pricePerToken) {
      sell = true;
      tokensLeft--;
      distribution.refundedAmount = Number(
        bigDecimal.subtract(distribution.refundedAmount, token.pricePerToken),
      );
      distribution.totalBought! += 1;
      distribution.totalPaid = Number(bigDecimal.add(distribution.totalPaid, token.pricePerToken));
      distributions[i] = distribution;
    }
    i = (i + 1) % distributions.length;
    if (i == 0 && !sell) {
      break;
    }
  }
};

const cancelPublicSale = async (token: Token) => {
  const distributionDocs = (
    await admin
      .firestore()
      .collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`)
      .where('totalDeposit', '>', 0)
      .get()
  ).docs;

  const promises = distributionDocs.map(async (doc) => {
    const distribution = <TokenDistribution>doc.data();
    const batch = admin.firestore().batch();

    const order = <Transaction>(await orderDocRef(distribution.uid!, token).get()).data();
    const payments = (await allPaymentsQuery(distribution.uid!, token.uid).get()).docs.map(
      (d) => <Transaction>d.data(),
    );
    const creditPaymentId = await createCredit(
      token,
      { ...distribution, refundedAmount: distribution?.totalDeposit },
      payments,
      order,
      batch,
    );

    batch.update(doc.ref, uOn({ creditPaymentId, totalDeposit: 0 }));

    await batch.commit();
  });

  const results = await Promise.allSettled(promises);
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => String((<PromiseRejectedResult>r).reason));
  const status = isEmpty(errors) ? TokenStatus.AVAILABLE : TokenStatus.ERROR;
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update(uOn({ status }));

  if (status === TokenStatus.ERROR) {
    functions.logger.error('Token processing error', token.uid, errors);
  }
};

const processTokenDistribution = async (token: Token) => {
  const distributionsSnap = await admin
    .firestore()
    .collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`)
    .where('totalDeposit', '>', 0)
    .get();
  const totalBought = distributionsSnap.docs.reduce(
    (sum, doc) => sum + getTokenCount(token, doc.data().totalDeposit),
    0,
  );

  const totalPublicSupply = getTotalPublicSupply(token);

  const distributions = distributionsSnap.docs
    .sort((a, b) => b.data().totalDeposit - a.data().totalDeposit)
    .map((d) =>
      getMemberDistribution(<TokenDistribution>d.data(), token, totalPublicSupply, totalBought),
    );

  if (totalBought > totalPublicSupply) {
    distributeLeftoverTokens(distributions, totalPublicSupply, token);
  }

  const promises = distributions.filter((p) => !p.reconciled).map(reconcileBuyer(token));
  const results = await Promise.allSettled(promises);
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => String((<PromiseRejectedResult>r).reason));
  const status = isEmpty(errors) ? TokenStatus.PRE_MINTED : TokenStatus.ERROR;
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update(uOn({ status }));

  if (status === TokenStatus.ERROR) {
    functions.logger.error('Token processing error', token.uid, errors);
  }
};

const mintToken = async (token: Token) => {
  await cancelAllActiveSales(token!.uid);
  await setIpfsData(token);

  const order = <Transaction>{
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: token.mintingData?.mintedBy,
    space: token!.space,
    network: token.mintingData?.network,
    payload: {
      type: TransactionMintTokenType.MINT_ALIAS,
      amount: token.mintingData?.aliasStorageDeposit,
      sourceAddress: token.mintingData?.vaultAddress,
      token: token.uid,
    },
  };
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const cancelAllActiveSales = async (token: string) => {
  const runTransaction = () =>
    admin.firestore().runTransaction(async (transaction) => {
      const query = admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .where('token', '==', token)
        .limit(150);
      const docRefs = (await query.get()).docs.map((d) => d.ref);
      const promises = (isEmpty(docRefs) ? [] : await transaction.getAll(...docRefs))
        .filter((d) => d.data()?.status === TokenTradeOrderStatus.ACTIVE)
        .map((d) =>
          cancelTradeOrderUtil(
            new FirestoreTransaction(admin.firestore(), transaction),
            <TokenTradeOrder>d.data(),
            TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN,
          ),
        );
      return (await Promise.all(promises)).length;
    });
  await guardedRerun(async () => (await runTransaction()) !== 0);
};

const setIpfsData = async (token: Token) => {
  const metadata = tokenToIpfsMetadata(token);
  const ipfs = await downloadMediaAndPackCar(token.uid, token.icon!, metadata);

  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${token.uid}`)
    .update(
      uOn({
        mediaStatus: MediaStatus.PENDING_UPLOAD,
        ipfsMedia: ipfs.ipfsMedia,
        ipfsMetadata: ipfs.ipfsMetadata,
        ipfsRoot: ipfs.ipfsRoot,
      }),
    );
};

const onTokenVaultEmptied = async (token: Token) => {
  const wallet = await WalletService.newWallet(token.mintingData?.network);
  const vaultBalance = await wallet.getBalance(token.mintingData?.vaultAddress!);
  const minter = <Member>(
    (await admin.firestore().doc(`${COL.MEMBER}/${token.mintingData?.mintedBy}`).get()).data()
  );
  const paymentsSnap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.sourceTransaction', 'array-contains', token.mintingData?.vaultAddress!)
    .where('type', '==', TransactionType.PAYMENT)
    .get();
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: minter.uid,
    network: token.mintingData?.network,
    payload: {
      type: TransactionCreditType.TOKEN_VAULT_EMPTIED,
      dependsOnBillPayment: true,
      amount: vaultBalance,
      sourceAddress: token.mintingData?.vaultAddress!,
      targetAddress: getAddress(minter, token.mintingData?.network!),
      sourceTransaction: paymentsSnap.docs.map((d) => d.id),
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  await admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`).create(cOn(credit));
};
