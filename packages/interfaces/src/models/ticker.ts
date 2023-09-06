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
  /**
   * Current price in USD (source https://api-pub.bitfinex.com/v2/)
   */
  price: number;
}
