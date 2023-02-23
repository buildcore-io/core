/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Member, MemberDeprecated, Token } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

const DEV_TOKEN_ID = '0xcef8ddcea97a5b82921d1cadbc8ccddcd69341da';
const TEST_TOKEN_ID = '0xe71439be7001d2311658ded364e4043a284d16f4';
const PROD_TOKEN_ID = '0x05a1a9b2fe190d67ad2df020f112e3e91f32d90e';

export const memberStatRoll = async (app: App) => {
  const db = getFirestore(app);

  const tokenUid = getTokenId(app);
  const tokenDocRef = db.doc(`${COL.TOKEN}/${tokenUid}`);
  const token = <Token>(await tokenDocRef.get()).data();

  let lastDoc: any | undefined = undefined;

  do {
    let query = db.collection(COL.MEMBER).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();

    snap.docs.forEach((doc) => {
      const member = doc.data() as MemberDeprecated;

      const memberUpdateData: Member = {
        uid: doc.id,
        updatedOn: FieldValue.serverTimestamp() as any,

        awardsCompleted: member.awardsCompleted || 0,
        totalReward: (member.totalReputation || 0) * XP_TO_SHIMMER,

        spaces: {},
      };

      for (const [space, memberSpaceData] of Object.entries(member.spaces || {})) {
        memberUpdateData.spaces![space] = {
          uid: space,
          updatedOn: FieldValue.serverTimestamp() as any,

          awardStat: {
            [tokenUid]: {
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
      batch.set(doc.ref, memberUpdateData, { merge: true });
    });

    await batch.commit();
  } while (lastDoc);
};

const getTokenId = (app: App) => {
  const projectId = (app.options.credential as any).projectId;
  if (projectId === 'soonaverse') {
    return PROD_TOKEN_ID;
  }
  if (projectId === 'soonaverse-test') {
    return TEST_TOKEN_ID;
  }
  return DEV_TOKEN_ID;
};

const XP_TO_SHIMMER = 1000000;

export const roll = memberStatRoll;
