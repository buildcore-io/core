/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EthAddress,
  PROD_AVAILABLE_MINTABLE_NETWORKS,
  TEST_AVAILABLE_MINTABLE_NETWORKS,
} from '@build-5/interfaces';
import { CommonJoi } from '../services/joi/common';
import { isProdEnv } from '../utils/config.utils';

export const AVAILABLE_NETWORKS = isProdEnv()
  ? PROD_AVAILABLE_MINTABLE_NETWORKS
  : TEST_AVAILABLE_MINTABLE_NETWORKS;

export interface Context<T = undefined> {
  ip: string;
  owner: string;
  params: T;
  headers: any;
}

export interface UidSchemaObject {
  uid: EthAddress;
}
export const uidSchema = { uid: CommonJoi.uid() };
