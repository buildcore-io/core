import { Notification, Opr, PublicCollections } from '@build-5/interfaces';
import { Build5Env } from '../Config';
import { CrudRepository } from './CrudRepository';

export class NotificationRepository extends CrudRepository<Notification> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.NOTIFICATION);
  }

  public getByMemberLive = (member: string, startAfter?: string, limit?: number) => {
    const params = {
      collection: this.col,
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
