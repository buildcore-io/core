import { BaseRecord } from './base';

/**
 * Available tickers.
 */
export enum TICKERS {
  SMRUSD = 'SMRUSD',
  IOTAUSD = 'IOTAUSD',
}

/**
 * Ticker record.
 */
export interface Ticker extends BaseRecord {
  price: number;
}
