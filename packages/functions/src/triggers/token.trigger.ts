import { IBatch, build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  MIN_IOTA_AMOUNT,
  MediaStatus,
  Member,
  SUB_COL,
  Space,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import { WalletService } from '../services/wallet/wallet.service';
import { getAddress } from '../utils/address.utils';
import { downloadMediaAndPackCar, tokenToIpfsMetadata } from '../utils/car.utils';
import { getProject, guardedRerun } from '../utils/common.utils';
import { getRoyaltyFees } from '../utils/royalty.utils';
import { cancelTradeOrderUtil } from '../utils/token-trade.utils';
import {
  BIG_DECIMAL_PRECISION,
  allPaymentsQuery,
  getTotalPublicSupply,
  memberDocRef,
  orderDocRef,
} from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';
import { FirestoreDocEvent } from './common';

export const onTokenStatusUpdated = async (event: FirestoreDocEvent<Token>) => {
  const { prev, curr } = event;

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
};

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
  batch: IBatch,
) => {
  if (!distribution.totalPaid) {
    return { billPaymentId: '', royaltyBillPaymentId: '' };
  }
  let balance =
    distribution.totalPaid +
    (distribution.refundedAmount! < MIN_IOTA_AMOUNT ? distribution.refundedAmount! : 0);
  const member = <Member>await memberDocRef(distribution.uid!).get();
  const [royaltySpaceId, fee] = Object.entries(
    await getRoyaltyFees(balance, member.tokenPurchaseFeePercentage, true),
  )[0];

  let royaltyPayment: Transaction | undefined = undefined;
  if (fee >= MIN_IOTA_AMOUNT && balance - fee >= MIN_IOTA_AMOUNT) {
    const royaltySpace = await build5Db().doc(`${COL.SPACE}/${royaltySpaceId}`).get<Space>();
    const network = order.network || DEFAULT_NETWORK;
    royaltyPayment = {
      project: getProject(order),
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: distribution.uid,
      network,
      payload: {
        type: TransactionPayloadType.TOKEN_PURCHASE,
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
    const royaltyPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${royaltyPayment.uid}`);
    batch.create(royaltyPaymentDocRef, royaltyPayment);
    balance -= fee;
  }
  const network = order.network || DEFAULT_NETWORK;
  const billPayment: Transaction = {
    project: getProject(order),
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: distribution.uid,
    network,
    payload: {
      type: TransactionPayloadType.TOKEN_PURCHASE,
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
  const billPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
  batch.create(billPaymentDocRef, billPayment);
  return { billPaymentId: billPayment.uid, royaltyBillPaymentId: royaltyPayment?.uid || '' };
};

const createCredit = async (
  token: Token,
  distribution: TokenDistribution,
  payments: Transaction[],
  order: Transaction,
  batch: IBatch,
) => {
  if (!distribution.refundedAmount) {
    return '';
  }
  const member = <Member>await memberDocRef(distribution.uid!).get();
  const tranId = getRandomEthAddress();
  const docRef = build5Db().doc(`${COL.TRANSACTION}/${tranId}`);
  const network = order.network || DEFAULT_NETWORK;
  const data: Transaction = {
    project: getProject(order),
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: member.uid,
    network,
    payload: {
      dependsOnBillPayment: true,
      type: TransactionPayloadType.TOKEN_PURCHASE,
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
  batch.create(docRef, data);
  return tranId;
};

const reconcileBuyer = (token: Token) => async (distribution: TokenDistribution) => {
  const batch = build5Db().batch();
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
  const distributionDoc = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(distribution.uid!);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${token.space}`);
  const space = (await spaceDocRef.get<Space>())!;

  const order = <Transaction>await orderDocRef(distribution.uid!, token).get();
  const payments = await allPaymentsQuery(distribution.uid!, token.uid).get<Transaction>();

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

  batch.update(distributionDoc, {
    ...distribution,
    tokenOwned: build5Db().inc(distribution.totalBought || 0),
    reconciled: true,
    billPaymentId,
    royaltyBillPaymentId,
    creditPaymentId,
  });
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
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
  const distributions = await tokenDocRef
    .collection(SUB_COL.DISTRIBUTION)
    .where('totalDeposit', '>', 0)
    .get<TokenDistribution>();

  const promises = distributions.map(async (distribution) => {
    const batch = build5Db().batch();

    const order = <Transaction>await orderDocRef(distribution.uid!, token).get();
    const payments = await allPaymentsQuery(distribution.uid!, token.uid).get<Transaction>();
    const creditPaymentId = await createCredit(
      token,
      { ...distribution, refundedAmount: distribution?.totalDeposit },
      payments,
      order,
      batch,
    );

    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(distribution.uid!);
    batch.update(distributionDocRef, { creditPaymentId, totalDeposit: 0 });

    await batch.commit();
  });

  const results = await Promise.allSettled(promises);
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => String((<PromiseRejectedResult>r).reason));
  const status = isEmpty(errors) ? TokenStatus.AVAILABLE : TokenStatus.ERROR;
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({ status });

  if (status === TokenStatus.ERROR) {
    console.error('Token processing error', token.uid, errors);
  }
};

const processTokenDistribution = async (token: Token) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
  const distributionsSnap = await tokenDocRef
    .collection(SUB_COL.DISTRIBUTION)
    .where('totalDeposit', '>', 0)
    .get<TokenDistribution>();
  const totalBought = distributionsSnap.reduce(
    (sum, doc) => sum + getTokenCount(token, doc.totalDeposit || 0),
    0,
  );

  const totalPublicSupply = getTotalPublicSupply(token);

  const distributions = distributionsSnap
    .sort((a, b) => (b.totalDeposit || 0) - (a.totalDeposit || 0))
    .map((d) => getMemberDistribution(<TokenDistribution>d, token, totalPublicSupply, totalBought));

  if (totalBought > totalPublicSupply) {
    distributeLeftoverTokens(distributions, totalPublicSupply, token);
  }

  const promises = distributions.filter((p) => !p.reconciled).map(reconcileBuyer(token));
  const results = await Promise.allSettled(promises);
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => String((<PromiseRejectedResult>r).reason));
  const status = isEmpty(errors) ? TokenStatus.PRE_MINTED : TokenStatus.ERROR;
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({ status });

  if (status === TokenStatus.ERROR) {
    console.error('Token processing error', token.uid, errors);
  }
};

const mintToken = async (token: Token) => {
  await cancelAllActiveSales(token!.uid);
  await setIpfsData(token);

  const order: Transaction = {
    project: getProject(token),
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: token.mintingData?.mintedBy,
    space: token!.space,
    network: token.mintingData?.network!,
    payload: {
      type: TransactionPayloadType.MINT_ALIAS,
      amount: token.mintingData?.aliasStorageDeposit,
      sourceAddress: token.mintingData?.vaultAddress,
      token: token.uid,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const cancelAllActiveSales = async (token: string) => {
  const runTransaction = () =>
    build5Db().runTransaction(async (transaction) => {
      const snap = build5Db()
        .collection(COL.TOKEN_MARKET)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .where('token', '==', token)
        .limit(150)
        .get<TokenTradeOrder>();
      const docRefs = (await snap).map((to) => build5Db().doc(`${COL.TOKEN_MARKET}/${to.uid}`));
      const promises = (await transaction.getAll<TokenTradeOrder>(...docRefs))
        .filter((d) => d && d.status === TokenTradeOrderStatus.ACTIVE)
        .map((d) =>
          cancelTradeOrderUtil(transaction, d!, TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN),
        );
      return (await Promise.all(promises)).length;
    });
  await guardedRerun(async () => (await runTransaction()) !== 0);
};

const setIpfsData = async (token: Token) => {
  const metadata = tokenToIpfsMetadata(token);
  const ipfs = await downloadMediaAndPackCar(token.uid, token.icon!, metadata);

  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({
    mediaStatus: MediaStatus.PENDING_UPLOAD,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsMetadata: ipfs.ipfsMetadata,
    ipfsRoot: ipfs.ipfsRoot,
  });
};

const onTokenVaultEmptied = async (token: Token) => {
  const wallet = await WalletService.newWallet(token.mintingData?.network);
  const { amount: vaultBalance } = await wallet.getBalance(token.mintingData?.vaultAddress!);
  const minter = await build5Db().doc(`${COL.MEMBER}/${token.mintingData?.mintedBy}`).get<Member>();
  const paymentsSnap = await build5Db()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.PAYMENT)
    .where('payload.sourceTransaction', 'array-contains', token.mintingData?.vaultAddress!)
    .get<Transaction>();
  const credit: Transaction = {
    project: getProject(token),
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: minter!.uid,
    network: token.mintingData?.network!,
    payload: {
      type: TransactionPayloadType.TOKEN_VAULT_EMPTIED,
      dependsOnBillPayment: true,
      amount: Number(vaultBalance),
      sourceAddress: token.mintingData?.vaultAddress!,
      targetAddress: getAddress(minter, token.mintingData?.network!),
      sourceTransaction: paymentsSnap.map((p) => p.uid),
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).create(credit);
};
