import {
  COL,
  Network,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import * as admin from 'firebase-admin';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

const tranId = '';
const memberUid = '';
const tokenId = '';
const sourceAddress = '';
// 1 RMS.
const refundAmount = 1;
db.collection(COL.MEMBER)
  .doc(memberUid)
  .get()
  .then(async (member) => {
    if (member.data()) {
      await db
        .collection(COL.TRANSACTION)
        .doc(tranId)
        .set(<Transaction>{
          type: TransactionType.CREDIT,
          uid: tranId,
          space: '',
          member: member.data()!.uid,
          createdOn: admin.firestore.Timestamp.now(),
          network: Network.SMR,
          payload: {
            type: TransactionPayloadType.TOKEN_BUY,
            amount: refundAmount,
            sourceAddress: sourceAddress,
            targetAddress: (member.data()?.validatedAddress || {})[Network.SMR] || '',
            sourceTransaction: [],
            token: tokenId,
            reconciled: false,
            void: false,
          },
        });

      console.log('Sent ' + refundAmount + ' to ' + member.data()?.name + ', ' + memberUid);
    }
  });
