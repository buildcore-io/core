import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cyrb53 } from '../../interfaces/hash.utils';
import { COL, SUB_COL } from '../../interfaces/models/base';
import serviceAccount from '../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const members: any = {};
const db = getFirestore();
const record = COL.SPACE;
db.collection(record).get().then(async (snapshot) => {
  let i = 0;
  for (const tran of snapshot.docs) {
    // GET ALL MEMBERS
    const hash = cyrb53([tran.data().uid,...Object.keys(tran.data().alliances || {})].join(''))

    // TODO Generate Alliance HASH
    await db.collection(record).doc(tran.id).collection(SUB_COL.MEMBERS).get().then(async (snapshot2) => {
      for (const mem of snapshot2.docs) {
        // Set member obj.
        members[mem.data().uid] = members[mem.data().uid] || [];
        members[mem.data().uid].push(cyrb53(tran.data().uid));

        // Already have some alliances.
        if (cyrb53(tran.data().uid) !== hash) {
          members[mem.data().uid].push(hash);
        }
      }
    });

    // Park update.
    console.log('Getting...' + i + '...' + tran.data().uid);
    i++;
  }

  // Go by each member and update.
  i = 0;
  for (const [key, entities] of <any>Object.entries(members)) {
      const refMember: any = db.collection(COL.MEMBER).doc(key);
      const docMember: any = await refMember.get();
      if (!docMember.exists) {
        continue;
      }
      const data: any = docMember.data();
      // console.log(entities);
      data.linkedEntities = entities;
      // console.log('Updating...' + i + '...' + key);
      await refMember.update(data);
      i++;
  }
});
