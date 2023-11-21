import { BaseRecord, BaseSubCollection, Timestamp } from './base';
import { Network } from './transaction';

/**
 * Project Model
 */
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

  otr: { [key: string]: ProjectOtr };
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
  nativeTokenSymbol?: string;
  nativeTokenUid?: string;
}

/**
 * Project Guardian subcollection.
 */
export interface ProjectAdmin extends BaseSubCollection {
  /**
   * Member ID {@link Member}
   */
  uid: string;
  /**
   * Admin joined on
   */
  createdOn: Timestamp;
}

export interface ProjectApiKey extends BaseSubCollection {
  uid: string;
  createdOn: Timestamp;
}

export interface ProjectOtr {
  network: Network;
  targetAddress: string;
}
