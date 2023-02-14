import {
  BillPaymentType,
  calcStakedMultiplier,
  COL,
  Entity,
  Member,
  Stake,
  StakeType,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { head } from 'lodash';
import admin, { inc } from '../../admin.config';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { getAddress } from '../../utils/address.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../../utils/dateTime.utils';
import { dropToOutput } from '../../utils/token-minting-utils/member.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

const LOOP_SIZE = 10000;

export const onAirdropClaim = async (order: Transaction) => {
  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`);
  const token = <Token>(await tokenDocRef.get()).data();

  if (order.payload.type === TransactionOrderType.TOKEN_AIRDROP) {
    return await onPreMintedAirdropClaim(order, token);
  }
  return await onMintedAirdropClaim(order, token);
};

const onPreMintedAirdropClaim = async (order: Transaction, token: Token) => {
  if (![TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED].includes(token.status)) {
    return;
  }
  await runInAirdropLoop(
    order,
    token,
    true,
  )((transaction, airdrop) => {
    const airdropDocRef = admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`);

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: order.space,
      member: order.member,
      network: order.network,
      ignoreWallet: true,
      ignoreWalletReason: TransactionIgnoreWalletReason.PRE_MINTED_AIRDROP_CLAIM,
      payload: {
        type: BillPaymentType.PRE_MINTED_AIRDROP_CLAIM,
        amount: 0,
        sourceTransaction: [order.uid],
        quantity: order.payload.quantity || null,
        airdropId: airdrop.uid,
        token: token.uid,
        tokenSymbol: token.symbol,
      },
    };
    const billPaymentDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
    transaction.create(billPaymentDocRef, cOn(billPayment));

    transaction.update(
      airdropDocRef,
      uOn({ status: TokenDropStatus.CLAIMED, billPaymentId: billPayment.uid }),
    );

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`);
    transaction.set(
      distributionDocRef,
      uOn({
        parentId: order.payload.token,
        parentCol: COL.TOKEN,
        uid: order.member,
        tokenClaimed: inc(airdrop.count),
        tokenOwned: inc(airdrop.count),
        totalUnclaimedAirdrop: inc(-airdrop.count),
      }),
      { merge: true },
    );
    return billPayment.payload.amount;
  });
};

const onMintedAirdropClaim = async (order: Transaction, token: Token) => {
  const paymentsSnap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.PAYMENT)
    .where('sourceTransaction', 'array-contains', order.uid)
    .get();
  const paymentsId = paymentsSnap.docs.map((d) => d.id);

  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${order.member}`);
  const member = <Member>(await memberDocRef.get()).data();

  const wallet = (await WalletService.newWallet(token.mintingData?.network!)) as SmrWallet;
  let storageDepositUsed = await claimOwnedMintedTokens(order, paymentsId, token, member, wallet);

  storageDepositUsed += await runInAirdropLoop(
    order,
    token,
  )((transaction, airdrop) => {
    const airdropDocRef = admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`);

    const billPayment = mintedDropToBillPayment(order, paymentsId, token, airdrop, member, wallet);
    const billPaymentDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
    transaction.create(billPaymentDocRef, cOn(billPayment));

    if (airdrop.award) {
      const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${airdrop.award}`);
      transaction.update(awardDocRef, uOn({ airdropClaimed: inc(1) }));
    }

    const stake = mintedDropToStake(order, airdrop, billPayment);
    if (stake) {
      const stakeDocRef = admin.firestore().doc(`${COL.STAKE}/${stake.uid}`);
      transaction.create(stakeDocRef, cOn(stake));
    }

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    if (!airdrop.sourceAddress) {
      transaction.update(tokenDocRef, uOn({ 'mintingData.tokensInVault': inc(-airdrop.count) }));
    }

    if (airdrop.orderId) {
      const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${airdrop.orderId}`);
      transaction.update(orderDocRef, uOn({ 'payload.unclaimedAirdrops': inc(-1) }));
    }

    if (!airdrop.isBaseToken) {
      const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member.uid);
      transaction.set(
        distributionDocRef,
        uOn({
          parentId: token.uid,
          parentCol: COL.TOKEN,
          uid: member.uid,
          tokenClaimed: inc(airdrop.count),
          tokenOwned: inc(airdrop.count),
          totalUnclaimedAirdrop: inc(-airdrop.count),
          mintedClaimedOn: serverTime(),
        }),
        { merge: true },
      );
    }

    transaction.update(
      airdropDocRef,
      uOn({ status: TokenDropStatus.CLAIMED, billPaymentId: billPayment.uid }),
    );
    return airdrop.isBaseToken ? 0 : billPayment.payload.amount;
  });

  if (storageDepositUsed < order.payload.amount) {
    const credit = <Transaction>{
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: member.uid,
      network: order.network,
      payload: {
        amount: order.payload.amount - storageDepositUsed,
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(member, order.network!),
        sourceTransaction: paymentsId,
        token: token.uid,
        reconciled: true,
        void: false,
      },
    };
    await admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`).create(cOn(credit));
  }
};

const claimOwnedMintedTokens = (
  order: Transaction,
  sourceTransaction: string[],
  token: Token,
  member: Member,
  wallet: SmrWallet,
) =>
  admin.firestore().runTransaction(async (transaction) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(order.member!);
    const distribution = <TokenDistribution | undefined>(
      (await transaction.get(distributionDocRef)).data()
    );
    if (distribution?.mintedClaimedOn || !distribution?.tokenOwned) {
      return 0;
    }

    const airdrop: TokenDrop = {
      uid: getRandomEthAddress(),
      member: member.uid,
      token: token.uid,
      createdOn: dateToTimestamp(dayjs()),
      vestingAt: dateToTimestamp(dayjs()),
      count: distribution?.tokenOwned,
      status: TokenDropStatus.UNCLAIMED,
    };

    const billPayment = mintedDropToBillPayment(
      order,
      sourceTransaction,
      token,
      airdrop,
      member,
      wallet,
    );
    const billPaymentDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
    transaction.create(billPaymentDocRef, cOn(billPayment));

    const stake = mintedDropToStake(order, airdrop, billPayment);
    if (stake) {
      const stakeDocRef = admin.firestore().doc(`${COL.STAKE}/${stake.uid}`);
      transaction.create(stakeDocRef, cOn(stake));
    }
    transaction.update(distributionDocRef, uOn({ mintedClaimedOn: serverTime() }));
    transaction.update(tokenDocRef, uOn({ 'mintingData.tokensInVault': inc(-airdrop.count) }));
    return billPayment.payload.amount;
  });

const mintedDropToBillPayment = (
  order: TransactionOrder,
  sourceTransaction: string[],
  token: Token,
  drop: TokenDrop,
  member: Member,
  wallet: SmrWallet,
) => {
  const memberAddress = getAddress(member, token.mintingData?.network!);
  const output = dropToOutput(token, drop, memberAddress, wallet.info);
  const nativeTokens = [{ id: head(output.nativeTokens)?.id, amount: drop.count }];
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: order.member,
    network: order.network,
    payload: {
      type: drop.isBaseToken
        ? BillPaymentType.BASE_AIRDROP_CLAIM
        : BillPaymentType.MINTED_AIRDROP_CLAIM,
      amount: drop.isBaseToken ? drop.count : Number(output.amount),
      nativeTokens: drop.isBaseToken ? [] : nativeTokens,
      previousOwnerEntity: Entity.SPACE,
      previousOwner: token.space,
      ownerEntity: Entity.MEMBER,
      owner: order.member,
      storageDepositSourceAddress: drop.isBaseToken ? '' : order.payload.targetAddress,
      vestingAt: dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : null,
      sourceAddress: drop.sourceAddress || token.mintingData?.vaultAddress!,
      targetAddress: memberAddress,
      sourceTransaction,
      quantity: drop.count,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
};

const mintedDropToStake = (order: TransactionOrder, drop: TokenDrop, billPayment: Transaction) => {
  const vestingAt = dayjs(drop.vestingAt.toDate());
  const weeks = vestingAt.diff(dayjs(), 'w');
  if (weeks < 1 || drop.isBaseToken) {
    return undefined;
  }
  const stake: Stake = {
    uid: getRandomEthAddress(),
    member: order.member!,
    token: order.payload.token!,
    type: drop.stakeType || StakeType.DYNAMIC,
    space: order.space!,
    amount: drop.count,
    value: Math.floor(drop.count * calcStakedMultiplier(weeks)),
    weeks,
    expiresAt: dateToTimestamp(vestingAt),
    billPaymentId: billPayment.uid,
    expirationProcessed: false,
    orderId: order.uid,
    leftCheck: vestingAt.valueOf(),
    rightCheck: dayjs().valueOf(),
  };
  billPayment.payload.stake = stake.uid;
  return stake;
};

const airdropsQuery = (
  order: Transaction,
  token: Token,
  member: string,
  isPreMintedClaim?: boolean,
) => {
  let query = admin
    .firestore()
    .collection(COL.AIRDROP)
    .where('token', '==', token.uid)
    .where('member', '==', member)
    .where('status', '==', TokenDropStatus.UNCLAIMED);
  if (isPreMintedClaim) {
    query = query.where('vestingAt', '<=', dateToTimestamp(dayjs()));
  } else {
    query = query.where('createdOn', '<=', order.createdOn).orderBy('createdOn');
  }
  query = query.limit(50);
  return query;
};

const runInAirdropLoop =
  (order: Transaction, token: Token, isPreMintedClaim?: boolean) =>
  async (func: (transaction: admin.firestore.Transaction, airdrop: TokenDrop) => number) => {
    let storageDeposit = 0;
    for (let i = 0; i < LOOP_SIZE; ++i) {
      const snap = await airdropsQuery(order, token, order.member!, isPreMintedClaim).get();
      if (!snap.size) {
        return storageDeposit;
      }
      const refs = snap.docs.map((d) => d.ref);
      storageDeposit += await admin.firestore().runTransaction(async (transaction) => {
        let actStorageDeposit = 0;
        const airdrops = (await transaction.getAll(...refs))
          .map((d) => d.data() as TokenDrop)
          .filter((drop) => drop.status === TokenDropStatus.UNCLAIMED);
        for (const airdrop of airdrops) {
          actStorageDeposit += func(transaction, airdrop);
        }
        return actStorageDeposit;
      });
    }
    return storageDeposit;
  };
