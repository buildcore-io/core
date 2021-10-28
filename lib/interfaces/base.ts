import { Timestamp } from 'firebase/firestore';

export interface Base {
  uid: string;
}

export interface BaseRecord extends Base {
  createdOn: Timestamp;
}
