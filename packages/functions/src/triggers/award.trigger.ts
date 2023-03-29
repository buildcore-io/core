import {
  Award,
  AwardBadgeType,
  COL,
  Member,
  Token,
  Transaction,
  TransactionAwardType,
  TransactionCreditType,
  TransactionType,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { soonDb } from '../firebase/firestore/soondb';
import { scale } from '../scale.settings';
import { getAddress } from '../utils/address.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const awardUpdateTrigger = functions
  .runWith({
    timeoutSeconds: 540,
    minInstances: scale(WEN_FUNC.awardTrigger),
  })
  .firestore.document(COL.AWARD + '/{awardId}')
  .onUpdate(async (change) => {
    const prev = <Award>change.before.data();
    const curr = <Award | undefined>change.after.data();
    if (!curr || !curr.funded) {
      return;
    }

    if (
      (prev.completed !== curr.completed || prev.badgesMinted !== curr.badgesMinted) &&
      curr.completed &&
      curr.badgesMinted === curr.issued
    ) {
      const memberDocRef = soonDb().doc(`${COL.MEMBER}/${curr.fundedBy}`);
      const member = await memberDocRef.get<Member>();
      const targetAddress = getAddress(member, curr.network);

      const burnAlias = <Transaction>{
        type: TransactionType.AWARD,
        uid: getRandomEthAddress(),
        space: curr.space,
        member: curr.fundedBy,
        network: curr.network,
        payload: {
          type: TransactionAwardType.BURN_ALIAS,
          sourceAddress: curr.address,
          targetAddress,
          reconciled: false,
          void: false,
          award: curr.uid,
        },
      };
      await soonDb().doc(`${COL.TRANSACTION}/${burnAlias.uid}`).create(burnAlias);

      const remainingBadges = curr.badge.total - curr.issued;
      if (curr.badge.type === AwardBadgeType.BASE && remainingBadges) {
        const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${curr.badge.tokenUid}`);
        const token = (await tokenDocRef.get<Token>())!;
        const baseTokenCredit = <Transaction>{
          type: TransactionType.CREDIT,
          uid: getRandomEthAddress(),
          space: curr.space,
          member: curr.fundedBy,
          network: curr.network,
          payload: {
            type: TransactionCreditType.AWARD_COMPLETED,
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
        await soonDb().doc(`${COL.TRANSACTION}/${baseTokenCredit.uid}`).create(baseTokenCredit);
      }
    }

    if (
      curr.badge.type === AwardBadgeType.NATIVE &&
      (prev.completed !== curr.completed || prev.airdropClaimed !== curr.airdropClaimed) &&
      curr.completed &&
      curr.airdropClaimed === curr.issued
    ) {
      const memberDocRef = soonDb().doc(`${COL.MEMBER}/${curr.fundedBy}`);
      const member = await memberDocRef.get<Member>();
      const targetAddress = getAddress(member, curr.network);

      const remainingBadges = curr.badge.total - curr.issued;

      const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${curr.badge.tokenUid}`);
      const token = (await tokenDocRef.get<Token>())!;

      const nativeTokensCredit = <Transaction>{
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: curr.space,
        member: curr.fundedBy,
        network: curr.network,
        payload: {
          type: TransactionCreditType.AWARD_COMPLETED,
          amount: curr.nativeTokenStorageDeposit,
          nativeTokens: remainingBadges
            ? [{ id: curr.badge.tokenId, amount: remainingBadges * curr.badge.tokenReward }]
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
      await soonDb().doc(`${COL.TRANSACTION}/${nativeTokensCredit.uid}`).create(nativeTokensCredit);
    }
  });
