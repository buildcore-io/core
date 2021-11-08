import { Timestamp } from "firebase/firestore";

export const enum DOCUMENTS {
  MEMBER = "member",
  SPACE = "space",
  PROPOSAL = "proposal"
}

export type EthAddress = string;

export interface Base {
  uid: string;
}

export interface BaseRecord extends Base {
  createdOn?: Timestamp;
  updatedOn?: Timestamp;
}
