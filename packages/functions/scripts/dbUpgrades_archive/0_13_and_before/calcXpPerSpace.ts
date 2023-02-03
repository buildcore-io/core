import { COL, TransactionAwardType } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const members: any = {};
const db = getFirestore();
const record = COL.TRANSACTION;
db.collection(record)
  .get()
  .then(async (snapshot) => {
    let i = 0;
    for (const tran of snapshot.docs) {
      if (tran.data() && tran.data().payload.type === TransactionAwardType.BADGE) {
        // Set member obj.
        members[tran.data().member] = members[tran.data().member] || {};

        members[tran.data().member].awardsCompleted =
          (members[tran.data().member].awardsCompleted || 0) + 1;
        members[tran.data().member].totalReputation =
          (members[tran.data().member].totalReputation || 0) + tran.data().payload.xp;

        // Calculate for space.
        members[tran.data().member].spaces = members[tran.data().member].spaces || {};
        members[tran.data().member].spaces[tran.data().space] = members[tran.data().member].spaces[
          tran.data().space
        ] || { uid: tran.data().space };
        members[tran.data().member].spaces[tran.data().space].badges =
          members[tran.data().member].spaces[tran.data().space].badges || [];
        members[tran.data().member].spaces[tran.data().space].badges.push(tran.id);
        members[tran.data().member].spaces[tran.data().space].awardsCompleted =
          (members[tran.data().member].spaces[tran.data().space].awardsCompleted || 0) + 1;
        members[tran.data().member].spaces[tran.data().space].totalReputation =
          (members[tran.data().member].spaces[tran.data().space].totalReputation || 0) +
          tran.data().payload.xp;

        // Park update.
        console.log('Getting...' + i + '...' + tran.data().member);
        i++;
      }
    }

    // Go by each member and update.
    i = 0;
    for (const [key, member] of <any>Object.entries(members)) {
      const refMember: any = db.collection(COL.MEMBER).doc(key);
      const docMember: any = await refMember.get();
      if (!docMember.exists) {
        continue;
      }
      const data: any = docMember.data();
      data.spaces = member.spaces;
      delete data.statsPerSpace;
      data.awardsCompleted = member.awardsCompleted;
      data.totalReputation = member.totalReputation;
      console.log('Updating...' + i + '...' + key);
      refMember.update(data);
      i++;
    }
  });
