import { COL, EthAddress } from '../../models';

export interface VoteRequest {
  collection: COL.TOKEN | COL.COLLECTION;
  uid: EthAddress;
  direction: -1 | 0 | 1;
}
