import {
  COL,
  StakeType,
  SUB_COL,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  WenError,
} from '@soonaverse/interfaces';
import { chunk } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export interface TokenDropRequest {
  readonly vestingAt: Date;
  readonly count: number;
  readonly recipient: string;
  readonly stakeType?: StakeType;
}

const hasAvailableTokenToAirdrop = (token: Token, count: number) => {
  const publicPercentage = token.allocations.find((a) => a.isPublicSale)?.percentage || 0;
  const totalPublicSupply = Math.floor(token.totalSupply * (publicPercentage / 100));
  return token.totalSupply - totalPublicSupply - token.totalAirdropped >= count;
};

export const airdropTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const chunks = chunk(params.drops as TokenDropRequest[], 200);
  for (const chunk of chunks) {
    await soonDb().runTransaction(async (transaction) => {
      const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.token}`);
      const token = await transaction.get<Token>(tokenDocRef);

      if (!token) {
        throw invalidArgument(WenError.token_does_not_exist);
      }

      assertTokenApproved(token);
      assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

      await assertIsGuardian(token.space, owner);

      const totalDropped = chunk.reduce((sum, { count }) => sum + count, 0);
      if (!hasAvailableTokenToAirdrop(token, totalDropped)) {
        throw invalidArgument(WenError.no_tokens_available_for_airdrop);
      }

      transaction.update(tokenDocRef, { totalAirdropped: soonDb().inc(totalDropped) });

      for (const drop of chunk) {
        const airdrop: TokenDrop = {
          createdBy: owner,
          uid: getRandomEthAddress(),
          member: drop.recipient.toLowerCase(),
          token: token.uid,
          vestingAt: dateToTimestamp(drop.vestingAt),
          count: drop.count,
          status: TokenDropStatus.UNCLAIMED,
        };
        const docRef = soonDb().doc(`${COL.AIRDROP}/${airdrop.uid}`);
        transaction.create(docRef, airdrop);

        const distributionDocRef = tokenDocRef
          .collection(SUB_COL.DISTRIBUTION)
          .doc(drop.recipient.toLowerCase());
        transaction.set(
          distributionDocRef,
          {
            parentId: token.uid,
            parentCol: COL.TOKEN,
            uid: drop.recipient.toLowerCase(),
            totalUnclaimedAirdrop: soonDb().inc(drop.count),
          },
          true,
        );
      }
    });
  }
};
