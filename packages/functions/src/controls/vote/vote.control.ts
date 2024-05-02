import { IDocument, PgTokenStatsUpdate, Update, build5Db } from '@build-5/database';
import { COL, SUB_COL, VoteRequest, WenError } from '@build-5/interfaces';
import { hasStakedTokens } from '../../services/stake.service';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const voteControl = async ({ owner, params, project }: Context<VoteRequest>) => {
  const hasStakedSoons = await hasStakedTokens(project, owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const col = params.collection === 'collection' ? COL.COLLECTION : COL.TOKEN;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parentDocRef: IDocument<any, any, Update> = build5Db().doc(col, params.uid);
  const parent = await parentDocRef.get();
  if (!parent) {
    if (col === COL.COLLECTION) {
      throw invalidArgument(WenError.collection_does_not_exists);
    }
    throw invalidArgument(WenError.token_does_not_exist);
  }

  await build5Db().runTransaction(async (transaction) => {
    const voteDocRef = build5Db().doc(col, params.uid, SUB_COL.VOTES, owner);
    const prevVote = await transaction.get(voteDocRef);

    if (!params.direction) {
      prevVote && (await transaction.delete(voteDocRef));
    } else {
      await transaction.upsert(voteDocRef, {
        parentId: params.uid,
        direction: params.direction,
      });
    }

    const change = getVoteChagens(prevVote?.direction || 0, params.direction);
    const votes = {
      upvotes: build5Db().inc(change.upvotes),
      downvotes: build5Db().inc(change.downvotes),
      voteDiff: build5Db().inc(change.voteDiff),
    };
    await transaction.upsert(parentDocRef, {
      votes_upvotes: votes.upvotes,
      votes_downvotes: votes.downvotes,
      votes_voteDiff: votes.voteDiff,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statsDocRef: IDocument<any, any, PgTokenStatsUpdate> = build5Db().doc(
      col,
      params.uid,
      SUB_COL.STATS,
      params.uid,
    );
    await transaction.upsert(statsDocRef, {
      parentId: params.uid,
      votes_upvotes: votes.upvotes,
      votes_downvotes: votes.downvotes,
      votes_voteDiff: votes.voteDiff,
    });
  });

  const voteDocRef = build5Db().doc(col, params.uid, SUB_COL.VOTES, owner);
  return (await voteDocRef.get())!;
};

const getVoteChagens = (prevDir: number, currDir: number) => {
  const change = {
    upvotes: 0,
    downvotes: 0,
    voteDiff: -prevDir + currDir,
  };
  change[currDir > 0 ? 'upvotes' : 'downvotes'] += Math.abs(currDir);
  change[prevDir > 0 ? 'upvotes' : 'downvotes'] -= Math.abs(prevDir);
  return change;
};
