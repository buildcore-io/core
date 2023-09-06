import { BaseRecord } from './base';

/**
 * Badge record.
 */
export interface Badge extends BaseRecord {
  /**
   * Badge name.
   */
  name: string;
  /**
   * Badge owners.
   */
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
}
