import { BaseRecord } from './base';

/**
 * Badge record.
 */
export interface Badge extends BaseRecord {
  name: string;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
}
