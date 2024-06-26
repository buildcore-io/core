/**
 * This file was automatically generated by knex
 * Do not modify this file manually
 */
import { ArrayRemove, ArrayUnion } from '../interfaces/common';
import * as commons from './common_update';

export interface PgMnemonicUpdate extends commons.BaseRecordUpdate {
  mnemonic?: string | null;
  network?: string | null;
  lockedBy?: string | null;
  consumedOutputIds?: string[] | null | ArrayUnion<string> | ArrayRemove<string>;
  consumedNftOutputIds?: string[] | null | ArrayUnion<string> | ArrayRemove<string>;
  consumedAliasOutputIds?: string[] | null | ArrayUnion<string> | ArrayRemove<string>;
}
