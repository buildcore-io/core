import { Notification, PublicCollections } from '@soon/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class NotificationRepository extends CrudRepository<Notification> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.NOTIFICATION);
  }
}
