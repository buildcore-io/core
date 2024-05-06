import {
  BuildcoreRequest,
  Dataset,
  NftStake,
  NftStakeRequest,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * NFT Stake Dataset.
 */
export class NftStakeDataset<D extends Dataset> extends DatasetClass<D, NftStake> {
  /**
   * Stake NFT
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link NftStakeRequest}
   * @returns
   */
  stake = (req: BuildcoreRequest<NftStakeRequest>) =>
    this.sendRequest(WEN_FUNC.stakeNft)<NftStakeRequest, Transaction>(req);
}
