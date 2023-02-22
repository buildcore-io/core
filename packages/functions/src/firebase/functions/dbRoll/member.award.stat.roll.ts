import { COL, Member, MemberDeprecated } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { isEmpty, last } from 'lodash';
import admin from '../../../admin.config';
import { LastDocType } from '../../../utils/common.utils';
import { xpTokenId, xpTokenUid } from '../../../utils/config.utils';
import { serverTime, uOn } from '../../../utils/dateTime.utils';
import { getTokenByMintId } from '../../../utils/token.utils';
import { XP_TO_SHIMMER } from './award.roll';

export const memberAwardStatRoll = functions
  .runWith({ maxInstances: 1, timeoutSeconds: 540 })
  .https.onRequest(async (req, res) => {
    const selectedMembers = (req.body.members || []) as string[];
    if (selectedMembers.length > 10) {
      res.sendStatus(400);
      return;
    }
    let lastDoc: LastDocType | undefined = undefined;
    const token = (await getTokenByMintId(xpTokenId()))!;

    do {
      let query = admin.firestore().collection(COL.MEMBER).limit(500);
      if (!isEmpty(selectedMembers)) {
        query = query.where(admin.firestore.FieldPath.documentId(), 'in', selectedMembers);
      }
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap = await query.get();
      lastDoc = last(snap.docs);

      const batch = admin.firestore().batch();

      snap.docs.forEach((doc) => {
        const member = doc.data() as MemberDeprecated;

        const memberUpdateData: Member = {
          uid: doc.id,

          awardsCompleted: member.awardsCompleted || 0,
          totalReward: (member.totalReputation || 0) * XP_TO_SHIMMER,

          spaces: {},
        };

        for (const [space, memberSpaceData] of Object.entries(member.spaces || {})) {
          memberUpdateData.spaces![space] = {
            uid: space,
            updatedOn: serverTime(),

            awardStat: {
              [xpTokenUid()]: {
                tokenSymbol: token.symbol,
                badges: memberSpaceData.badges || [],
                completed: memberSpaceData.awardsCompleted || 0,
                totalReward: (memberSpaceData.totalReputation || 0) * XP_TO_SHIMMER,
              },
            },

            awardsCompleted: memberSpaceData.awardsCompleted || 0,
            totalReward: (memberSpaceData.totalReputation || 0) * XP_TO_SHIMMER,
          };
        }
        batch.set(doc.ref, uOn(memberUpdateData), { merge: true });
      });

      await batch.commit();
    } while (lastDoc);

    res.sendStatus(200);
  });
