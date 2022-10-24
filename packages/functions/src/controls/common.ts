import {
  PROD_AVAILABLE_MINTABLE_NETWORKS,
  TEST_AVAILABLE_MINTABLE_NETWORKS,
} from '@soon/interfaces';
import { isProdEnv } from '../utils/config.utils';

export const AVAILABLE_NETWORKS = isProdEnv()
  ? PROD_AVAILABLE_MINTABLE_NETWORKS
  : TEST_AVAILABLE_MINTABLE_NETWORKS;
