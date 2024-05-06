import { BaseRecord } from './base';

export const SYSTEM_CONFIG_DOC_ID = 'config';

/**
 * System Config record.
 */
export interface SystemConfig extends BaseRecord {
  readonly tokenTradingFeePercentage?: number;
  readonly tokenPurchaseFeePercentage?: number;
}

export const MAX_MILLISECONDS = 7978758988368;
