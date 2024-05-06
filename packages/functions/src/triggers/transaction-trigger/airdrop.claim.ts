import { ITransaction, PgTransaction, database } from '@buildcore/database';
import {
  COL,
  Entity,
  IgnoreWalletReason,
  Member,
  Network,
  SUB_COL,
  Stake,
  StakeType,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  calcStakedMultiplier,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { head } from 'lodash';
import { Wallet } from '../../services/wallet/wallet';
import { WalletService } from '../../services/wallet/wallet.service';
import { getAddress } from '../../utils/address.utils';
import { getProject } from '../../utils/common.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { logger } from '../../utils/logger';
import { dropToOutput } from '../../utils/token-minting-utils/member.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

const LOOP_SIZE = 10000;

export const onAirdropClaim = async (order: PgTransaction) => {
  const tokenDocRef = database().doc(COL.TOKEN, order.payload_token!);
  const token = (await tokenDocRef.get())!;

  if (order.payload_type === TransactionPayloadType.TOKEN_AIRDROP) {
    return await onPreMintedAirdropClaim(order, token);
  }
  return await onMintedAirdropClaim(order, token);
};

const onPreMintedAirdropClaim = async (order: PgTransaction, token: Token) => {
  if (![TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED].includes(token.status)) {
    return;
  }
  await runInAirdropLoop(
    order,
    token,
    true,
  )(async (transaction, airdrop) => {
    const airdropDocRef = database().doc(COL.AIRDROP, airdrop.uid);

    const billPayment: Transaction = {
      project: getProject(order),
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: order.space,
      member: order.member,
      network: order.network as Network,
      ignoreWallet: true,
      ignoreWalletReason: IgnoreWalletReason.PRE_MINTED_AIRDROP_CLAIM,
      payload: {
        type: TransactionPayloadType.PRE_MINTED_AIRDROP_CLAIM,
        amount: 0,
        sourceTransaction: [order.uid],
        quantity: order.payload_quantity || 0,
        airdropId: airdrop.uid,
        token: token.uid,
        tokenSymbol: token.symbol,
      },
    };
    const billPaymentDocRef = database().doc(COL.TRANSACTION, billPayment.uid);
    await transaction.create(billPaymentDocRef, billPayment);

    await transaction.update(airdropDocRef, {
      status: TokenDropStatus.CLAIMED,
      billPaymentId: billPayment.uid,
    });

    const distributionDocRef = database().doc(
      COL.TOKEN,
      order.payload_token!,
      SUB_COL.DISTRIBUTION,
      order.member,
    );
    await transaction.upsert(distributionDocRef, {
      parentId: order.payload_token,
      tokenClaimed: database().inc(airdrop.count),
      tokenOwned: database().inc(airdrop.count),
      totalUnclaimedAirdrop: database().inc(-airdrop.count),
    });
    return billPayment.payload.amount!;
  });
};

const onMintedAirdropClaim = async (order: PgTransaction, token: Token) => {
  const paymentsSnap = await database()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.PAYMENT)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where('payload_sourceTransaction', 'array-contains', order.uid as any)
    .get();
  const paymentsId = paymentsSnap.map((d) => d.uid);

  const memberDocRef = database().doc(COL.MEMBER, order.member!);
  const member = (await memberDocRef.get())!;

  const wallet = await WalletService.newWallet(token.mintingData?.network!);
  let storageDepositUsed = await claimOwnedMintedTokens(order, paymentsId, token, member, wallet);

  storageDepositUsed += await runInAirdropLoop(
    order,
    token,
  )(async (transaction, airdrop) => {
    const airdropDocRef = database().doc(COL.AIRDROP, airdrop.uid);

    const billPayment = await mintedDropToBillPayment(
      order,
      paymentsId,
      token,
      airdrop,
      member,
      wallet,
    );

    const stake = mintedDropToStake(order, airdrop, billPayment);
    if (stake) {
      const stakeDocRef = database().doc(COL.STAKE, stake.uid);
      await transaction.create(stakeDocRef, stake);
    }

    const billPaymentDocRef = database().doc(COL.TRANSACTION, billPayment.uid);
    await transaction.create(billPaymentDocRef, billPayment);

    const tokenDocRef = database().doc(COL.TOKEN, token.uid);
    if (!airdrop.sourceAddress) {
      await transaction.update(tokenDocRef, {
        mintingData_tokensInVault: database().inc(-airdrop.count),
      });
    }

    if (airdrop.orderId) {
      const orderDocRef = database().doc(COL.TRANSACTION, airdrop.orderId);
      await transaction.update(orderDocRef, { payload_unclaimedAirdrops: database().inc(-1) });
    }

    const distributionDocRef = database().doc(
      COL.TOKEN,
      token.uid,
      SUB_COL.DISTRIBUTION,
      member.uid,
    );
    await transaction.upsert(distributionDocRef, {
      parentId: token.uid,
      tokenClaimed: database().inc(airdrop.count),
      tokenOwned: database().inc(airdrop.count),
      totalUnclaimedAirdrop: database().inc(-airdrop.count),
      mintedClaimedOn: dayjs().toDate(),
    });

    await transaction.update(airdropDocRef, {
      status: TokenDropStatus.CLAIMED,
      billPaymentId: billPayment.uid,
    });
    return airdrop.isBaseToken ? 0 : billPayment.payload.amount!;
  });

  if (storageDepositUsed < order.payload_amount!) {
    logger.info('onMintedAirdropClaim', order.uid, storageDepositUsed, order.payload_amount);
    const network = (order.network as Network)!;
    const credit: Transaction = {
      project: getProject(order),
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: member.uid,
      network,
      payload: {
        type: TransactionPayloadType.CLAIM_MINTED_TOKEN,
        amount: order.payload_amount! - storageDepositUsed,
        sourceAddress: order.payload_targetAddress,
        targetAddress: getAddress(member, network),
        sourceTransaction: paymentsId,
        token: token.uid,
        reconciled: true,
        void: false,
      },
    };
    await database().doc(COL.TRANSACTION, credit.uid).create(credit);
  }
};

const claimOwnedMintedTokens = (
  order: PgTransaction,
  sourceTransaction: string[],
  token: Token,
  member: Member,
  wallet: Wallet,
) =>
  database().runTransaction(async (transaction) => {
    const distributionDocRef = database().doc(
      COL.TOKEN,
      token.uid,
      SUB_COL.DISTRIBUTION,
      order.member!,
    );
    const distribution = (await transaction.get(distributionDocRef))!;
    if (distribution?.mintedClaimedOn || !distribution?.tokenOwned) {
      return 0;
    }

    const airdrop: TokenDrop = {
      project: getProject(order),
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

    const stake = mintedDropToStake(order, airdrop, billPayment);
    if (stake) {
      const stakeDocRef = database().doc(COL.STAKE, stake.uid);
      await transaction.create(stakeDocRef, stake);
    }

    const billPaymentDocRef = database().doc(COL.TRANSACTION, billPayment.uid);
    await transaction.create(billPaymentDocRef, billPayment);

    await transaction.update(distributionDocRef, { mintedClaimedOn: dayjs().toDate() });
    const tokenDocRef = database().doc(COL.TOKEN, token.uid);
    await transaction.update(tokenDocRef, {
      mintingData_tokensInVault: database().inc(-airdrop.count),
    });
    return billPayment.payload.amount!;
  });

const mintedDropToBillPayment = async (
  order: PgTransaction,
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
    project: getProject(order),
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: order.member,
    network: order.network as Network,
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
      storageDepositSourceAddress: drop.isBaseToken ? '' : order.payload_targetAddress,
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

const mintedDropToStake = (order: PgTransaction, drop: TokenDrop, billPayment: Transaction) => {
  const vestingAt = dayjs(drop.vestingAt.toDate());
  const weeks = vestingAt.diff(dayjs(), 'w');
  if (weeks < 1 || drop.isBaseToken) {
    return undefined;
  }
  const stake: Stake = {
    project: getProject(order),
    uid: getRandomEthAddress(),
    member: order.member!,
    token: order.payload_token!,
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
  order: PgTransaction,
  token: Token,
  member: string,
  isPreMintedClaim?: boolean,
) => {
  let query = database()
    .collection(COL.AIRDROP)
    .where('token', '==', token.uid)
    .where('member', '==', member)
    .where('status', '==', TokenDropStatus.UNCLAIMED);
  if (isPreMintedClaim) {
    query = query.where('vestingAt', '<=', dayjs().toDate());
  } else {
    query = query.where('createdOn', '<=', order.createdOn).orderBy('createdOn');
  }
  query = query.limit(50);
  return query;
};

const runInAirdropLoop =
  (order: PgTransaction, token: Token, isPreMintedClaim?: boolean) =>
  async (func: (transaction: ITransaction, airdrop: TokenDrop) => Promise<number>) => {
    let storageDeposit = 0;
    for (let i = 0; i < LOOP_SIZE; ++i) {
      const snap = await airdropsQuery(order, token, order.member!, isPreMintedClaim).get();
      if (!snap.length) {
        return storageDeposit;
      }
      storageDeposit += await database().runTransaction(async (transaction) => {
        const refs = snap.map((airdrop) => database().doc(COL.AIRDROP, airdrop.uid));
        let actStorageDeposit = 0;
        const airdrops = (await transaction.getAll(...refs)).filter(
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
