import { Dataset, NftStake, NftStakeRequest, WEN_FUNC } from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class NftStakeDataset<D extends Dataset> extends DatasetClass<D, NftStake> {
  stake = this.sendRequest(WEN_FUNC.stakeNft)<NftStakeRequest>;
}
