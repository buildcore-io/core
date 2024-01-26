import {
  Build5Request,
  Dataset,
  NftStake,
  NftStakeRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

/**
 * NFT Stake Dataset.
 */
export class NftStakeDataset<D extends Dataset> extends DatasetClass<D, NftStake> {
  /**
   * Stake NFT
   *
   * @param req Use {@link Build5Request} with data based on {@link NftStakeRequest}
   * @returns
   */
  stake = (req: Build5Request<NftStakeRequest>) =>
    this.sendRequest(WEN_FUNC.stakeNft)<NftStakeRequest, Transaction>(req);
}
