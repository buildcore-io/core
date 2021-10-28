import { Timestamp } from 'firebase/firestore';

export type EthAddress = string;

export interface Base {
  uid: string;
}

export interface BaseRecord extends Base {
  createdOn: Timestamp;
}
