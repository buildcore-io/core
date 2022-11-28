import { COL, SUB_COL, Vote, WenError, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin, { inc } from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { hasStakedSoonTokens } from '../services/stake.service';
import { cOn, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { decodeAuth } from '../utils/wallet.utils';

const schema = Joi.object({
  collection: Joi.string().equal(COL.COLLECTION, COL.TOKEN).required(),
  uid: CommonJoi.uid().required(),
  direction: Joi.number().equal(-1, 0, 1).required(),
});

export const voteController = functions
  .runWith({
    minInstances: scale(WEN_FUNC.voteController),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req, WEN_FUNC.tradeToken);
    const owner = params.address.toLowerCase();
    await assertValidationAsync(schema, params.body);

    const hasStakedSoons = await hasStakedSoonTokens(owner);
    if (!hasStakedSoons) {
      throw throwInvalidArgument(WenError.no_staked_soon);
    }

    const parentDocRef = admin.firestore().doc(`${params.body.collection}/${params.body.uid}`);
    const parent = (await parentDocRef.get()).data();
    if (!parent) {
      const errorMsg =
        params.body.collection === COL.COLLECTION
          ? WenError.collection_does_not_exists
          : WenError.token_does_not_exist;
      throw throwInvalidArgument(errorMsg);
    }

    await admin.firestore().runTransaction(async (transaction) => {
      const voteDocRef = parentDocRef.collection(SUB_COL.VOTES).doc(owner);
      const prevVote = <Vote | undefined>(await transaction.get(voteDocRef)).data();

      if (!params.body.direction) {
        prevVote && transaction.delete(voteDocRef);
      } else if (prevVote) {
        transaction.update(voteDocRef, uOn({ direction: params.body.direction }));
      } else {
        transaction.create(
          voteDocRef,
          cOn({
            uid: owner,
            parentCol: params.body.collection,
            parentId: params.body.uid,
            direction: params.body.direction,
          }),
        );
      }

      const change = getVoteChagens(prevVote?.direction || 0, params.body.direction);
      const votes = {
        upvotes: inc(change.upvotes),
        downvotes: inc(change.downvotes),
        voteDiff: inc(change.voteDiff),
      };
      const statsDocRef = parentDocRef.collection(SUB_COL.STATS).doc(params.body.uid);
      transaction.set(statsDocRef, { votes }, { merge: true });
    });

    return <Vote | undefined>(await parentDocRef.collection(SUB_COL.VOTES).doc(owner).get()).data();
  });

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
