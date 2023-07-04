import { COL, EthAddress } from '../../models';

export interface RankRequest {
  collection: COL;
  uid: EthAddress;
  rank: number;
}
