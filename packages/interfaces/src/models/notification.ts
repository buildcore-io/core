import { BaseRecord, NetworkAddress } from './base';
export enum NotificationType {
  NEW_BID = 'NEW_BID',
  LOST_BID = 'LOST_BID',
  WIN_BID = 'WIN_BID',
}

interface NotificationParams {
  member: {
    name: string;
  };
  amount: number;
  auction: string;
}
export interface NotificationBidParams extends NotificationParams {}

export interface NotificationWinBidParams extends NotificationParams {}

export interface NotificationLostBidParams extends NotificationParams {}

/**
 * Notification record.
 *
 * @deprecated
 */
export interface Notification extends BaseRecord {
  uid: NetworkAddress;
  space?: NetworkAddress;
  member?: NetworkAddress;
  type: NotificationType;
  params: NotificationBidParams | NotificationWinBidParams | NotificationLostBidParams;
}
