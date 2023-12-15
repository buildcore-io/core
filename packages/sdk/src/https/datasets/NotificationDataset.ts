import { Dataset, GetManyAdvancedRequest, Notification, Opr } from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class NotificationDataset<D extends Dataset> extends DatasetClass<D, Notification> {
  getByMemberLive = (member: string, startAfter?: string, limit?: number) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['member'],
      fieldValue: [member],
      operator: [Opr.EQUAL],
      startAfter,
      limit,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
