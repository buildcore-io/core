import { Dataset, Milestone } from '@buildcore/interfaces';
import { DatasetClass } from '../Dataset';

/**
 * Milestone Dataset
 *
 */
export class MilestoneDataset<D extends Dataset> extends DatasetClass<D, Milestone> {}
