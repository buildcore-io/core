import {
  COL,
  Entity,
  IgnoreWalletReason,
  Member,
  SUB_COL,
  Stake,
  StakeType,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  calcStakedMultiplier,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { head } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import { ITransaction } from '../../firebase/firestore/interfaces';
import { Wallet } from '../../services/wallet/wallet';
import { WalletService } from '../../services/wallet/wallet.service';
import { getAddress } from '../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { dropToOutput } from '../../utils/token-minting-utils/member.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

const LOOP_SIZE = 10000;

export const onAirdropClaim = async (order: Transaction) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${order.payload.token}`);
  const token = (await tokenDocRef.get<Token>())!;

  if (order.payload.type === TransactionPayloadType.TOKEN_AIRDROP) {
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
  )(async (transaction, airdrop) => {
    const airdropDocRef = build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`);

    const billPayment: Transaction = {
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: order.space,
      member: order.member,
      network: order.network,
      ignoreWallet: true,
      ignoreWalletReason: IgnoreWalletReason.PRE_MINTED_AIRDROP_CLAIM,
      payload: {
        type: TransactionPayloadType.PRE_MINTED_AIRDROP_CLAIM,
        amount: 0,
        sourceTransaction: [order.uid],
        quantity: order.payload.quantity || 0,
        airdropId: airdrop.uid,
        token: token.uid,
        tokenSymbol: token.symbol,
      },
    };
    const billPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
    transaction.create(billPaymentDocRef, billPayment);

    transaction.update(airdropDocRef, {
      status: TokenDropStatus.CLAIMED,
      billPaymentId: billPayment.uid,
    });

    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`,
    );
    transaction.set(
      distributionDocRef,
      {
        parentId: order.payload.token,
        parentCol: COL.TOKEN,
        uid: order.member,
        tokenClaimed: build5Db().inc(airdrop.count),
        tokenOwned: build5Db().inc(airdrop.count),
        totalUnclaimedAirdrop: build5Db().inc(-airdrop.count),
      },
      true,
    );
    return billPayment.payload.amount!;
  });
};

const onMintedAirdropClaim = async (order: Transaction, token: Token) => {
  const paymentsSnap = await build5Db()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.PAYMENT)
    .where('payload.sourceTransaction', 'array-contains', order.uid)
    .get<Transaction>();
  const paymentsId = paymentsSnap.map((d) => d.uid);

  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${order.member}`);
  const member = (await memberDocRef.get<Member>())!;

  const wallet = await WalletService.newWallet(token.mintingData?.network!);
  let storageDepositUsed = await claimOwnedMintedTokens(order, paymentsId, token, member, wallet);

  storageDepositUsed += await runInAirdropLoop(
    order,
    token,
  )(async (transaction, airdrop) => {
    const airdropDocRef = build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`);

    const billPayment = await mintedDropToBillPayment(
      order,
      paymentsId,
      token,
      airdrop,
      member,
      wallet,
    );
    const billPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
    transaction.create(billPaymentDocRef, billPayment);

    const stake = mintedDropToStake(order, airdrop, billPayment);
    if (stake) {
      const stakeDocRef = build5Db().doc(`${COL.STAKE}/${stake.uid}`);
      transaction.create(stakeDocRef, stake);
    }

    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
    if (!airdrop.sourceAddress) {
      transaction.update(tokenDocRef, {
        'mintingData.tokensInVault': build5Db().inc(-airdrop.count),
      });
    }

    if (airdrop.orderId) {
      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${airdrop.orderId}`);
      transaction.update(orderDocRef, { 'payload.unclaimedAirdrops': build5Db().inc(-1) });
    }

    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member.uid);
    transaction.set(
      distributionDocRef,
      {
        parentId: token.uid,
        parentCol: COL.TOKEN,
        uid: member.uid,
        tokenClaimed: build5Db().inc(airdrop.count),
        tokenOwned: build5Db().inc(airdrop.count),
        totalUnclaimedAirdrop: build5Db().inc(-airdrop.count),
        mintedClaimedOn: dayjs().toDate(),
      },
      true,
    );

    transaction.update(airdropDocRef, {
      status: TokenDropStatus.CLAIMED,
      billPaymentId: billPayment.uid,
    });
    return airdrop.isBaseToken ? 0 : billPayment.payload.amount!;
  });

  if (storageDepositUsed < order.payload.amount!) {
    const credit = <Transaction>{
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: member.uid,
      network: order.network,
      payload: {
        amount: order.payload.amount! - storageDepositUsed,
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(member, order.network!),
        sourceTransaction: paymentsId,
        token: token.uid,
        reconciled: true,
        void: false,
      },
    };
    await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).create(credit);
  }
};

const claimOwnedMintedTokens = (
  order: Transaction,
  sourceTransaction: string[],
  token: Token,
  member: Member,
  wallet: Wallet,
) =>
  build5Db().runTransaction(async (transaction) => {
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(order.member!);
    const distribution = (await transaction.get<TokenDistribution>(distributionDocRef))!;
    if (distribution?.mintedClaimedOn || !distribution?.tokenOwned) {
      return 0;
    }

    const airdrop: TokenDrop = {
      uid: getRandomEthAddress(),
      member: member.uid,
      token: token.uid,
      createdOn: serverTime(),
      vestingAt: serverTime(),
      count: distribution?.tokenOwned,
      status: TokenDropStatus.UNCLAIMED,
    };

    const billPayment = await mintedDropToBillPayment(
      order,
      sourceTransaction,
      token,
      airdrop,
      member,
      wallet,
    );
    const billPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
    transaction.create(billPaymentDocRef, billPayment);

    const stake = mintedDropToStake(order, airdrop, billPayment);
    if (stake) {
      const stakeDocRef = build5Db().doc(`${COL.STAKE}/${stake.uid}`);
      transaction.create(stakeDocRef, stake);
    }
    transaction.update(distributionDocRef, { mintedClaimedOn: dayjs().toDate() });
    transaction.update(tokenDocRef, {
      'mintingData.tokensInVault': build5Db().inc(-airdrop.count),
    });
    return billPayment.payload.amount!;
  });

const mintedDropToBillPayment = async (
  order: Transaction,
  sourceTransaction: string[],
  token: Token,
  drop: TokenDrop,
  member: Member,
  wallet: Wallet,
): Promise<Transaction> => {
  const memberAddress = getAddress(member, token.mintingData?.network!);
  const output = await dropToOutput(wallet, token, drop, memberAddress);
  const nativeTokens = [{ id: head(output.nativeTokens)?.id!, amount: BigInt(drop.count) }];
  return {
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: order.member,
    network: order.network,
    payload: {
      type: drop.isBaseToken
        ? TransactionPayloadType.BASE_AIRDROP_CLAIM
        : TransactionPayloadType.MINTED_AIRDROP_CLAIM,
      amount: drop.isBaseToken ? drop.count : Number(output.amount),
      nativeTokens: drop.isBaseToken ? [] : nativeTokens,
      previousOwnerEntity: Entity.SPACE,
      previousOwner: token.space,
      ownerEntity: Entity.MEMBER,
      owner: order.member!,
      storageDepositSourceAddress: drop.isBaseToken ? '' : order.payload.targetAddress,
      vestingAt: dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : null,
      sourceAddress: drop.sourceAddress || token.mintingData?.vaultAddress!,
      targetAddress: memberAddress,
      sourceTransaction,
      quantity: drop.count,
      token: token.uid,
      tokenSymbol: token.symbol,
      award: drop.award || null,
    },
  };
};

const mintedDropToStake = (order: Transaction, drop: TokenDrop, billPayment: Transaction) => {
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
  let query = build5Db()
    .collection(COL.AIRDROP)
    .where('token', '==', token.uid)
    .where('member', '==', member)
    .where('status', '==', TokenDropStatus.UNCLAIMED);
  if (isPreMintedClaim) {
    query = query.where('vestingAt', '<=', serverTime());
  } else {
    query = query.where('createdOn', '<=', order.createdOn).orderBy('createdOn');
  }
  query = query.limit(50);
  return query;
};

const runInAirdropLoop =
  (order: Transaction, token: Token, isPreMintedClaim?: boolean) =>
  async (func: (transaction: ITransaction, airdrop: TokenDrop) => Promise<number>) => {
    let storageDeposit = 0;
    for (let i = 0; i < LOOP_SIZE; ++i) {
      const snap = await airdropsQuery(
        order,
        token,
        order.member!,
        isPreMintedClaim,
      ).get<TokenDrop>();
      if (!snap.length) {
        return storageDeposit;
      }
      const refs = snap.map((airdrop) => build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`));
      storageDeposit += await build5Db().runTransaction(async (transaction) => {
        let actStorageDeposit = 0;
        const airdrops = (await transaction.getAll<TokenDrop>(...refs)).filter(
          (drop) => drop!.status === TokenDropStatus.UNCLAIMED,
        );
        for (const airdrop of airdrops) {
          actStorageDeposit += await func(transaction, airdrop!);
        }
        return actStorageDeposit;
      });
    }
    return storageDeposit;
  };
