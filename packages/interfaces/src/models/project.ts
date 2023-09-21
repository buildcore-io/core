import { BaseRecord, BaseSubCollection, Timestamp } from './base';

export interface Project extends BaseRecord {
  /**
   * Name of the project
   */
  name: string;
  /**
   * Email of a contact to this project
   */
  contactEmail?: string;
  /**
   * Boolean flag to show if project is deactivated, default value is undefined
   */
  deactivated?: boolean;
  /**
   * The config object of the project
   */
  config: ProjectConfig;
}

export enum ProjectBilling {
  TOKEN_BASE = 'token_based',
  VOLUME_BASED = 'volume_based',
}

export interface ProjectConfig {
  /**
   *The billing type of the project
   */
  billing: ProjectBilling;

  tiers?: number[];
  tokenTradingFeeDiscountPercentage?: number[];
  baseTokenSymbol?: string;
  baseTokenUid?: string;
}

/**
 * Project Guardian subcollection.
 */
export interface ProjectGuardian extends BaseSubCollection {
  /**
   * Member ID {@link Member}
   */
  uid: string;
  /**
   * Guardian joined on
   */
  createdOn: Timestamp;
}

export interface ProjectApiKey extends BaseSubCollection {
  uid: string;
  createdOn: Timestamp;
}
