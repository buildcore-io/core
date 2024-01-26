import {
  Build5Request,
  Dataset,
  NftStake,
  NftStakeRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class NftStakeDataset<D extends Dataset> extends DatasetClass<D, NftStake> {
  stake = (req: Build5Request<NftStakeRequest>) =>
    this.sendRequest(WEN_FUNC.stakeNft)<NftStakeRequest, Transaction>(req);
}
