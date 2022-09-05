import { Timestamp } from "./base";
import { Network } from "./transaction";

export interface Mnemonic {
  readonly mnemonic?: string;
  readonly network?: Network;
  readonly createdOn?: Timestamp;
  readonly lockedBy?: string;
  readonly consumedOutputIds?: string[];
}