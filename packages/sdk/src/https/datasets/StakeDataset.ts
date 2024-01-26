import {
  Build5Request,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Stake,
  TokenStakeRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class StakeDataset<D extends Dataset> extends DatasetClass<D, Stake> {
  deposit = (req: Build5Request<TokenStakeRequest>) =>
    this.sendRequest(WEN_FUNC.depositStake)<TokenStakeRequest, Transaction>(req);

  getByMemberLive = (member: string, startAfter?: string, limit?: number) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['member'],
      fieldValue: [member],
      operator: [Opr.EQUAL],
      startAfter,
      limit,
      orderBy: ['expiresAt'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
