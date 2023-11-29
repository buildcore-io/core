import { Dataset, Stamp, StampRequest, WEN_FUNC } from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class StampDataset<D extends Dataset> extends DatasetClass<D, Stamp> {
  stamp = this.sendRequest(WEN_FUNC.stamp)<StampRequest>;
}
