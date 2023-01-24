/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, SUB_COL, TokenDistribution, TokenDrop } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

const REGEX = /[A-Z]/;

export const uppercaseMemberFix = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any = undefined;

  do {
    let query = db.collection(COL.AIRDROP).limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map(async (doc) => {
      const airdrop = doc.data() as TokenDrop;
      if (!REGEX.test(airdrop.member)) {
        return;
      }
      await db.runTransaction(async (transaction) => {
        const distributionDocRef = db
          .collection(COL.TOKEN)
          .doc(airdrop.token)
          .collection(SUB_COL.DISTRIBUTION)
          .doc(airdrop.member);
        const distribution = <TokenDistribution | undefined>(
          (await transaction.get(distributionDocRef)).data()
        );
        const member = airdrop.member.toLowerCase();

        transaction.update(doc.ref, { member: member });

        if (distribution) {
          const lowercaseDocRef = db
            .collection(COL.TOKEN)
            .doc(airdrop.token)
            .collection(SUB_COL.DISTRIBUTION)
            .doc(member);
          transaction.create(lowercaseDocRef, { ...distribution, uid: member });
          transaction.delete(distributionDocRef);
        }
      });
    });
    await Promise.all(promises);
  } while (lastDoc);
};

export const roll = uppercaseMemberFix;
