import { BaseRecord, NetworkAddress } from './base';
export enum NotificationType {
  NEW_BID = 'NEW_BID',
  LOST_BID = 'LOST_BID',
  WIN_BID = 'WIN_BID',
}

export interface NotificationBidParams {
  member: {
    name: string;
  };
  amount: number;
  nft: {
    uid: string;
    name: string;
  };
}

export interface NotificationWinBidParams {
  member: {
    name: string;
  };
  amount: number;
  nft: {
    uid: string;
    name: string;
  };
}

export interface NotificationLostBidParams {
  member: {
    name: string;
  };
  amount: number;
  nft: {
    uid: string;
    name: string;
  };
}

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
