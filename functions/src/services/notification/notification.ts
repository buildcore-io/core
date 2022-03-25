import { Member, Transaction } from '../../../interfaces/models';
import { Nft } from '../../../interfaces/models/nft';
import { Notification, NotificationType } from "../../../interfaces/models/notification";
import { serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export class NotificationService {
  public static prepareBid(member: Member, nft: Nft, tran: Transaction): Notification {
    return <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.NEW_BID,
      member: member.uid,
      params: {
        amount: tran.payload.amount,
        member: {
          name: member.name || member.uid
        },
        nft: {
          uid: nft.uid,
          name: nft.name || nft.uid
        }
      },
      createdOn: serverTime()
    }
  }
}
