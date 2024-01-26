import { Dataset, Ticker } from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Price ticker Dataset
 */
export class TickerDataset<D extends Dataset> extends DatasetClass<D, Ticker> {}
