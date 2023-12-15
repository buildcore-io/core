import { Badge, Dataset } from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class BadgesDataset<D extends Dataset> extends DatasetClass<D, Badge> {}
