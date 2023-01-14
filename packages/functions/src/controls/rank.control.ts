import { COL, Rank, SUB_COL, WenError, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { set } from 'lodash';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { hasStakedSoonTokens } from '../services/stake.service';
import { getRankingSpace, RANK_CONFIG } from '../utils/config.utils';
import { cOn, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { assertIsGuardian } from '../utils/token.utils';
import { decodeAuth } from '../utils/wallet.utils';

const schema = Joi.object({
  collection: Joi.string().equal(COL.COLLECTION, COL.TOKEN).required(),
  uid: CommonJoi.uid().required(),
  rank: Joi.number().integer().min(RANK_CONFIG.MIN_RANK).max(RANK_CONFIG.MAX_RANK).required(),
});

export const rankController = functions
  .runWith({
    minInstances: scale(WEN_FUNC.rankController),
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

    const rankingSpaceId = getRankingSpace(params.body.collection);
    await assertIsGuardian(rankingSpaceId, owner);

    await admin.firestore().runTransaction(async (transaction) => {
      const parrent = (await transaction.get(parentDocRef)).data()!;
      const rankDocRef = parentDocRef.collection(SUB_COL.RANKS).doc(owner);
      const prevRank = <Rank | undefined>(await transaction.get(rankDocRef)).data();

      if (prevRank) {
        transaction.update(rankDocRef, uOn({ rank: params.body.rank }));
      } else {
        transaction.create(
          rankDocRef,
          cOn({
            uid: owner,
            parentCol: params.body.collection,
            parentId: params.body.uid,
            rank: params.body.rank,
          }),
        );
      }

      const ranks = {
        count: (parrent.rankCount || 0) + (prevRank ? 0 : 1),
        sum: (parrent.rankSum || 0) + (-(prevRank?.rank || 0) + params.body.rank),
        avg: 0,
      };
      set(ranks, 'avg', Number((ranks.sum / ranks.count).toFixed(3)));

      transaction.update(parentDocRef, {
        rankCount: ranks.count,
        rankSum: ranks.sum,
        rankAvg: ranks.avg,
      });

      const statsDocRef = parentDocRef.collection(SUB_COL.STATS).doc(params.body.uid);
      transaction.set(statsDocRef, { ranks }, { merge: true });
    });

    return <Rank>(await parentDocRef.collection(SUB_COL.RANKS).doc(owner).get()).data();
  });
