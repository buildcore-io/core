/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  NetworkAddress,
  PROD_AVAILABLE_MINTABLE_NETWORKS,
  TEST_AVAILABLE_MINTABLE_NETWORKS,
} from '@buildcore/interfaces';
import { CommonJoi } from '../services/joi/common';
import { isProdEnv } from '../utils/config.utils';

export const AVAILABLE_NETWORKS = isProdEnv()
  ? PROD_AVAILABLE_MINTABLE_NETWORKS
  : TEST_AVAILABLE_MINTABLE_NETWORKS;

export interface Context<T = undefined> {
  ip: string;
  owner: string;
  params: T;
  project: string;
  headers: any;
  rawBody: any;
}

export interface UidSchemaObject {
  uid: NetworkAddress;
}
export const uidSchema = { uid: CommonJoi.uid() };
