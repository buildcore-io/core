import { Dataset, Milestone } from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

export class MilestoneDataset<D extends Dataset> extends DatasetClass<D, Milestone> {}
