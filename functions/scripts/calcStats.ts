import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COL } from '../interfaces/models/base';
import serviceAccount from './serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
const recs = [COL.MEMBER, COL.SPACE, COL.AWARD, COL.PROPOSAL, COL.TRANSACTION, COL.MILESTONE];
recs.forEach((r) => {
  // db.collection(r).get().then((snapshot) => {
  //   console.log('Total ' + r + ': ', snapshot.size);
  // });
});


// Export of members within space.
// 0xdf1ed923ad76de09600e88baa84327b32182288d/members
// console.log('spaceId,ETH_Address,Username,totalReputation,joined')
// db.collection('space').doc('0xdf1ed923ad76de09600e88baa84327b32182288d').collection('members').get().then(async (snapshot) => {
//   for (const member of snapshot.docs) {
//     const refMember: any = db.collection(COL.MEMBER).doc(member.data().uid);
//     const docMember: any = await refMember.get();
//     const data: any = docMember.data();
//     console.log(member.data().parentId+','+data.uid+','+data.name+','+(data.spaces?.[member.data().parentId]?.totalReputations || 0).toString()+','+member.data().createdOn.toDate().toString());
//   }
// });


// Find gaps in milestones.
// db.collection('milestone').get().then(async (snapshot) => {
//   let last = 0;
//   console.log('----Finding Milestones with gab:')
//   for (const member of snapshot.docs) {
//     if ((last + 1) !== parseInt(member.id)) {
//       // Create gab
//       if ((parseInt(member.id) - 1) !== last && last !== 0) {
//         console.log('----Another Milestone gab');
//       }
//       console.log(parseInt(member.id) - 1);
//     }

//     last = parseInt(member.id);
//   }
// });

db.collection('transaction').where('type', '==', 'ORDER').orderBy('createdOn').get().then(async (snapshot) => {
  for (const t of snapshot.docs) {
    console.log(t.data().uid, t.data().type, t.data().createdOn.toDate());
  }
});
