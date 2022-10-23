import * as admin from 'firebase-admin';

admin.initializeApp();

export default admin;

export interface DocumentSnapshotType extends admin.firestore.DocumentSnapshot {
  data(): any;
}
