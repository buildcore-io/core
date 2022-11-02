import { Notification, PublicCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class NotificationRepository extends CrudRepository<Notification> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.NOTIFICATION);
  }
}
