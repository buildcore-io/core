import { COL, cyrb53, SUB_COL } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const members: any = {};
const db = getFirestore();
const record = COL.SPACE;
db.collection(record)
  .get()
  .then(async (snapshot) => {
    let i = 0;
    for (const tran of snapshot.docs) {
      // TODO Generate HASH
      await db
        .collection(record)
        .doc(tran.id)
        .collection(SUB_COL.MEMBERS)
        .get()
        .then(async (snapshot2) => {
          for (const mem of snapshot2.docs) {
            // Set member obj.
            members[mem.data().uid] = members[mem.data().uid] || [];
            members[mem.data().uid].push(cyrb53(tran.data().uid));
          }
        });

      // Reset alliances. More relevant on test.
      db.collection(record).doc(tran.data().uid).update({
        alliances: null,
      });

      // Park update.
      console.log('Getting...' + i + '...' + tran.data().uid);
      i++;
    }

    // Go by each member and update.
    i = 0;
    for (const [key, entities] of <any>Object.entries(members)) {
      const refMember: any = db.collection(COL.MEMBER).doc(key);
      refMember.get().then((docMember: any) => {
        const data: any = docMember.data();
        // console.log(entities);
        data.linkedEntities = entities;
        refMember.update(data).then(() => {
          console.log('Updated...' + i + '...' + key);
        });
      });

      i++;
    }
  });
