import { COL, Collection, SUB_COL, Token, Vote, WenError } from '@build-5/interfaces';
import { build5Db } from '../firebase/firestore/build5Db';
import { hasStakedSoonTokens } from '../services/stake.service';
import { invalidArgument } from '../utils/error.utils';

export const voteControl = async (owner: string, params: Record<string, unknown>) => {
  const hasStakedSoons = await hasStakedSoonTokens(owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const parentDocRef = build5Db().doc(`${params.collection}/${params.uid}`);
  const parent = await parentDocRef.get<Token | Collection>();
  if (!parent) {
    const errorMsg =
      params.collection === COL.COLLECTION
        ? WenError.collection_does_not_exists
        : WenError.token_does_not_exist;
    throw invalidArgument(errorMsg);
  }

  await build5Db().runTransaction(async (transaction) => {
    const voteDocRef = parentDocRef.collection(SUB_COL.VOTES).doc(owner);
    const prevVote = await transaction.get<Vote | undefined>(voteDocRef);

    if (!params.direction) {
      prevVote && transaction.delete(voteDocRef);
    } else if (prevVote) {
      transaction.update(voteDocRef, { direction: params.direction });
    } else {
      transaction.create(voteDocRef, {
        uid: owner,
        parentCol: params.collection,
        parentId: params.uid,
        direction: params.direction,
      });
    }

    const change = getVoteChagens(prevVote?.direction || 0, params.direction as number);
    const votes = {
      upvotes: build5Db().inc(change.upvotes),
      downvotes: build5Db().inc(change.downvotes),
      voteDiff: build5Db().inc(change.voteDiff),
    };
    transaction.set(parentDocRef, { votes }, true);

    const statsDocRef = parentDocRef.collection(SUB_COL.STATS).doc(params.uid as string);
    transaction.set(statsDocRef, { votes }, true);
  });

  return await parentDocRef.collection(SUB_COL.VOTES).doc(owner).get<Vote | undefined>();
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
