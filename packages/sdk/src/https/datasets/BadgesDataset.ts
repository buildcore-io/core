import { Badge, Dataset } from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Badges dataset.
 */
export class BadgesDataset<D extends Dataset> extends DatasetClass<D, Badge> {}
