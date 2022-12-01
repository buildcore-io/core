import * as admin from 'firebase-admin';

admin.initializeApp();

export default admin;

export interface DocumentSnapshotType extends admin.firestore.DocumentSnapshot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data(): any;
}

export const inc = admin.firestore.FieldValue.increment;
