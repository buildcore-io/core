import { Dataset, Milestone } from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

/**
 * Milestone Dataset
 *
 */
export class MilestoneDataset<D extends Dataset> extends DatasetClass<D, Milestone> {}
