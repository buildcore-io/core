import {
  BuildcoreRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Stake,
  TokenStakeRequest,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Token Stake Dataset.
 */
export class StakeDataset<D extends Dataset> extends DatasetClass<D, Stake> {
  /**
   * Stake Token
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link TokenStakeRequest}
   * @returns
   */
  deposit = (req: BuildcoreRequest<TokenStakeRequest>) =>
    this.sendRequest(WEN_FUNC.depositStake)<TokenStakeRequest, Transaction>(req);

  /**
   * Get stakes by member. Real time stream.
   * @param member
   * @param startAfter
   * @param limit
   * @returns
   */
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
