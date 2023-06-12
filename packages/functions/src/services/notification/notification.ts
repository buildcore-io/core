import { Member, Nft, Notification, NotificationType, Transaction } from '@build5/interfaces';
import { OrderPayBillCreditTransaction } from '../../utils/common.utils';
import { serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export class NotificationService {
  public static prepareBid(member: Member, nft: Nft, tran: Transaction): Notification {
    return <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.NEW_BID,
      member: nft.owner,
      params: {
        amount: (<OrderPayBillCreditTransaction>tran.payload).amount,
        member: {
          name: member.name || member.uid,
        },
        nft: {
          uid: nft.uid,
          name: nft.name || nft.uid,
        },
      },
      createdOn: serverTime(),
    };
  }

  public static prepareWinBid(member: Member, nft: Nft, tran: Transaction): Notification {
    return <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.WIN_BID,
      member: member.uid,
      params: {
        amount: (<OrderPayBillCreditTransaction>tran.payload).amount,
        member: {
          name: member.name || member.uid,
        },
        nft: {
          uid: nft.uid,
          name: nft.name || nft.uid,
        },
      },
      createdOn: serverTime(),
    };
  }

  public static prepareLostBid(member: Member, nft: Nft, tran: Transaction): Notification {
    return <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.LOST_BID,
      member: member.uid,
      params: {
        amount: (<OrderPayBillCreditTransaction>tran.payload).amount,
        member: {
          name: member.name || member.uid,
        },
        nft: {
          uid: nft.uid,
          name: nft.name || nft.uid,
        },
      },
      createdOn: serverTime(),
    };
  }
}
