import {
  Notification,
  NotificationBidParams,
  NotificationLostBidParams,
  NotificationType,
  NotificationWinBidParams,
} from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgNotification } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class NotificationConverter implements Converter<Notification, PgNotification> {
  toPg = (notification: Notification): PgNotification => ({
    uid: notification.uid,
    project: notification.project,
    createdOn: notification.createdOn?.toDate(),
    updatedOn: notification.updatedOn?.toDate(),
    createdBy: notification.createdBy,
    space: notification.space,
    member: notification.member,
    type: notification.type,
    params: JSON.stringify(notification.params || {}) as any,
  });

  fromPg = (pg: PgNotification): Notification =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      space: pg.space,
      member: pg.member,
      type: pg.type as NotificationType,
      params: pg.params as unknown as
        | NotificationBidParams
        | NotificationWinBidParams
        | NotificationLostBidParams,
    });
}
