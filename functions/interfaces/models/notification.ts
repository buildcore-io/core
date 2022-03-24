import { BaseRecord, EthAddress } from './base';
export enum NotificationType {
  NEW_BID = 'NEW_BID'
}

export interface NotificationBidParams {
  member: {
    id: string,
    name: string
  },
  amount: number;
  nft: {
    id: string,
    name: string
  },
}

export interface Notification extends BaseRecord {
  uid: EthAddress;
  space?: EthAddress;
  member?: EthAddress;
  type: NotificationType;
  params: NotificationBidParams;
}
