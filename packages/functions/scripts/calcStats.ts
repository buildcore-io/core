import { COL, TransactionType } from '@buildcore/interfaces';
import { UnitsHelper } from '@iota/iota.js';
import dayjs from 'dayjs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
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

// db.collection('transaction').where('type', '==', 'PAYMENT').orderBy('createdOn', 'asc').get().then(async (snapshot) => {
//   for (const t of snapshot.docs) {
//     console.log(t.data().uid, t.data().member, t.data().type, t.data().payload.amount, t.data().createdOn.toDate());
//   }
// });

console.log('Getting data...');
let totalPayCount = 0;
let totalPay = 0;
let totalBillCount = 0;
let totalBillRoyCount = 0;
let totalBil = 0;
let totalBilRoy = 0;
let totalCreditCount = 0;
let totalCreditPay = 0;
let totalOrderCount = 0;
db.collection('transaction')
  .orderBy('createdOn', 'desc')
  .limit(1)
  .onSnapshot((querySnapshot) => {
    querySnapshot.docChanges().forEach(async (t) => {
      // Get user name
      const member: any = await db.collection('member').doc(t.doc.data().member).get();
      if (t.type === 'added') {
        if (t.doc.data().type === TransactionType.PAYMENT) {
          totalPayCount++;
          totalPay += t.doc.data().payload.amount;
          console.log(
            '+PAY-' +
              (t.doc.data().payload.invalidPayment ? 'Y' : 'N') +
              '\t\t' +
              totalOrderCount +
              '\t' +
              totalPayCount +
              '\t' +
              UnitsHelper.formatBest(totalPay) +
              '\t\t' +
              UnitsHelper.formatBest(t.doc.data().payload.amount) +
              '\t' +
              dayjs(t.doc.data().createdOn.toDate()).format('DD/MM HH:mm:ss') +
              '\t' +
              t.doc.data().uid +
              '\t' +
              member.data().name +
              '\t' +
              'https://soonaverse.com/member/' +
              t.doc.data().member,
          );
        } else if (t.doc.data().type === TransactionType.BILL_PAYMENT) {
          if (t.doc.data().payload.royalty) {
            totalBillRoyCount++;
            totalBilRoy += t.doc.data().payload.amount;
          } else {
            totalBillCount++;
            totalBil += t.doc.data().payload.amount;
          }
          console.log(
            '-BILL-' +
              (t.doc.data().payload.invalidPayment ? 'Y' : 'N') +
              '\t\t' +
              totalOrderCount +
              '\t' +
              (t.doc.data().payload.royalty ? totalBillRoyCount : totalBillCount) +
              '\t' +
              UnitsHelper.formatBest(t.doc.data().payload.royalty ? totalBilRoy : totalBil) +
              '\t\t' +
              UnitsHelper.formatBest(t.doc.data().payload.amount) +
              '\t' +
              dayjs(t.doc.data().createdOn.toDate()).format('DD/MM HH:mm:ss') +
              '\t' +
              t.doc.data().uid +
              '\t' +
              member.data().name +
              '\t' +
              'https://soonaverse.com/member/' +
              t.doc.data().member,
          );
        } else if (t.doc.data().type === TransactionType.CREDIT) {
          totalCreditCount++;
          totalCreditPay += t.doc.data().payload.amount;
          console.log(
            '-CREDIT-' +
              (t.doc.data().payload.invalidPayment ? 'Y' : 'N') +
              '\t\t' +
              totalOrderCount +
              '\t' +
              totalCreditCount +
              '\t' +
              UnitsHelper.formatBest(totalCreditPay) +
              '\t\t' +
              UnitsHelper.formatBest(t.doc.data().payload.amount) +
              '\t' +
              dayjs(t.doc.data().createdOn.toDate()).format('DD/MM HH:mm:ss') +
              '\t' +
              t.doc.data().uid +
              '\t' +
              member.data().name +
              '\t' +
              'https://soonaverse.com/member/' +
              t.doc.data().member,
          );
        } else if (t.doc.data().type === TransactionType.ORDER) {
          totalOrderCount++;
        }
      }
    });
  });
