import { BaseRecord } from './base';

export enum TICKERS {
  SMRUSD = 'SMRUSD',
  IOTAUSD = 'IOTAUSD',
}

export interface Ticker extends BaseRecord {
  price: number;
}
