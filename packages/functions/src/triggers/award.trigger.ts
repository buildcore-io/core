import { build5Db } from '@build-5/database';
import {
  Award,
  AwardBadgeType,
  COL,
  Token,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { head } from 'lodash';
import { getProject } from '../utils/common.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';
import { FirestoreDocEvent } from './common';

export const onAwardUpdated = async (event: FirestoreDocEvent<Award>) => {
  const { prev, curr } = event;
  if (!prev || !curr || !curr.funded) {
    return;
  }

  if (
    (prev.completed !== curr.completed || prev.badgesMinted !== curr.badgesMinted) &&
    curr.completed &&
    curr.badgesMinted === curr.issued
  ) {
    const targetAddress = await getReturnAddress(curr);

    const burnAlias = <Transaction>{
      project: getProject(curr),
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      space: curr.space,
      member: curr.fundedBy,
      network: curr.network,
      payload: {
        type: TransactionPayloadType.BURN_ALIAS,
        sourceAddress: curr.address,
        targetAddress,
        reconciled: false,
        void: false,
        award: curr.uid,
      },
    };
    await build5Db().doc(`${COL.TRANSACTION}/${burnAlias.uid}`).create(burnAlias);

    const remainingBadges = curr.badge.total - curr.issued;
    if (curr.badge.type === AwardBadgeType.BASE && remainingBadges) {
      const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${curr.badge.tokenUid}`);
      const token = (await tokenDocRef.get<Token>())!;
      const baseTokenCredit = <Transaction>{
        project: getProject(curr),
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: curr.space,
        member: curr.fundedBy,
        network: curr.network,
        payload: {
          type: TransactionPayloadType.AWARD_COMPLETED,
          amount: remainingBadges * curr.badge.tokenReward,
          sourceAddress: curr.address,
          targetAddress,
          reconciled: false,
          void: false,
          award: curr.uid,
          token: token.uid,
          tokenSymbol: token.symbol,
        },
      };
      await build5Db().doc(`${COL.TRANSACTION}/${baseTokenCredit.uid}`).create(baseTokenCredit);
    }
  }

  if (
    curr.badge.type === AwardBadgeType.NATIVE &&
    (prev.completed !== curr.completed || prev.airdropClaimed !== curr.airdropClaimed) &&
    curr.completed &&
    curr.airdropClaimed === curr.issued
  ) {
    const targetAddress = await getReturnAddress(curr);
    const remainingBadges = curr.badge.total - curr.issued;

    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${curr.badge.tokenUid}`);
    const token = (await tokenDocRef.get<Token>())!;

    const nativeTokensCredit: Transaction = {
      project: getProject(curr),
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      space: curr.space,
      member: curr.fundedBy,
      network: curr.network,
      payload: {
        type: TransactionPayloadType.AWARD_COMPLETED,
        amount: curr.nativeTokenStorageDeposit,
        nativeTokens: remainingBadges
          ? [
              {
                id: curr.badge.tokenId!,
                amount: BigInt(remainingBadges * curr.badge.tokenReward),
              },
            ]
          : [],
        sourceAddress: curr.address,
        targetAddress,
        reconciled: false,
        void: false,
        award: curr.uid,
        token: token.uid,
        tokenSymbol: token.symbol,
      },
    };
    await build5Db().doc(`${COL.TRANSACTION}/${nativeTokensCredit.uid}`).create(nativeTokensCredit);
  }
};

const getReturnAddress = async (award: Award) => {
  if (award.fundingAddress) {
    return award.fundingAddress;
  }
  const snap = await build5Db()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.PAYMENT)
    .where('payload.targetAddress', '==', award.address)
    .where('payload.invalidPayment', '==', false)
    .limit(1)
    .get<Transaction>();
  return head(snap)?.payload.sourceAddress || '';
};
