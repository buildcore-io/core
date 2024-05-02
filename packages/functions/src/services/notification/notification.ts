import { Member, Notification, NotificationType } from '@buildcore/interfaces';
import { serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export class NotificationService {
  public static prepareBid(member: Member, amount: number, auction: string): Notification {
    return <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.NEW_BID,
      member: member.uid,
      params: {
        amount: amount,
        member: {
          name: member.name || member.uid,
        },
        auction,
      },
      createdOn: serverTime(),
    };
  }

  public static prepareWinBid(member: Member, amount: number, auction: string): Notification {
    return <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.WIN_BID,
      member: member.uid,
      params: {
        amount: amount,
        member: {
          name: member.name || member.uid,
        },
        auction,
      },
      createdOn: serverTime(),
    };
  }

  public static prepareLostBid(member: Member, amount: number, auction: string): Notification {
    const notification = <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.LOST_BID,
      member: member.uid,
      params: { amount, member: { name: member.name || member.uid }, auction },
      createdOn: serverTime(),
    };

    return notification;
  }
}
