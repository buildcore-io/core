/**
 * This file was automatically generated by knex
 * Do not modify this file manually
 */
import * as commons from './common';

export interface PgSoonSnapshot extends commons.BaseRecord {
  count?: number;
  paidOut?: number;
  lastPaidOutOn?: Date;
  ethAddress?: string;
  ethAddressVerified?: boolean;
}