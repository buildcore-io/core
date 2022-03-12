
import * as admin from 'firebase-admin';

export interface DocumentSnapshotType extends admin.firestore.DocumentSnapshot {
  data(): any
}
