import { database } from '@buildcore/database';
import {
  COL,
  CreateAirdropsRequest,
  StakeType,
  SUB_COL,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  WenError,
} from '@buildcore/interfaces';
import { chunk } from 'lodash';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import {
  assertIsTokenGuardian,
  assertTokenApproved,
  assertTokenStatus,
} from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

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

export const airdropTokenControl = async ({
  owner,
  params,
  project,
}: Context<CreateAirdropsRequest>) => {
  const chunks = chunk(params.drops, 200);
  for (const chunk of chunks) {
    await database().runTransaction(async (transaction) => {
      const tokenDocRef = database().doc(COL.TOKEN, params.token);
      const token = await transaction.get(tokenDocRef);

      if (!token) {
        throw invalidArgument(WenError.token_does_not_exist);
      }

      assertTokenApproved(token);
      assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

      await assertIsTokenGuardian(token, owner);

      const totalDropped = chunk.reduce((sum, { count }) => sum + count, 0);
      if (!hasAvailableTokenToAirdrop(token, totalDropped)) {
        throw invalidArgument(WenError.no_tokens_available_for_airdrop);
      }

      await transaction.update(tokenDocRef, { totalAirdropped: database().inc(totalDropped) });

      for (const drop of chunk) {
        const airdrop: TokenDrop = {
          project,
          createdBy: owner,
          uid: getRandomEthAddress(),
          member: drop.recipient.toLowerCase(),
          token: token.uid,
          vestingAt: dateToTimestamp(drop.vestingAt),
          count: drop.count,
          status: TokenDropStatus.UNCLAIMED,
        };
        const docRef = database().doc(COL.AIRDROP, airdrop.uid);
        await transaction.create(docRef, airdrop);

        const distributionDocRef = database().doc(
          COL.TOKEN,
          params.token,
          SUB_COL.DISTRIBUTION,
          drop.recipient.toLowerCase(),
        );
        await transaction.upsert(distributionDocRef, {
          parentId: token.uid,
          totalUnclaimedAirdrop: database().inc(drop.count),
        });
      }
    });
  }
};
