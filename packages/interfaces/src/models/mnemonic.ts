import { BaseRecord, Timestamp } from './base';
import { Network } from './transaction';

/**
 * Mnemonic
 *
 * @hidden
 */
export interface Mnemonic extends BaseRecord {
  readonly mnemonic?: string;
  readonly network?: Network;
  readonly createdOn?: Timestamp;
  readonly lockedBy?: string;
  readonly consumedOutputIds?: string[];
  readonly consumedNftOutputIds?: string[];
  readonly consumedAliasOutputIds?: string[];
}
