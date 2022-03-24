import { Member, Transaction } from '../../../interfaces/models';
import { Nft } from '../../../interfaces/models/nft';
import { Notification, NotificationType } from "../../../interfaces/models/notification";
import { getRandomEthAddress } from '../../utils/wallet.utils';

export class NotificationService {
  public static prepareBid(member: Member, nft: Nft, tran: Transaction): Notification {
    return <Notification>{
      uid: getRandomEthAddress(),
      type: NotificationType.NEW_BID,
      params: {
        amount: tran.payload.amount,
        member: {
          id: member.uid,
          name: member.name || member.uid
        },
        nft: {
          id: nft.uid,
          name: nft.name || nft.uid
        }
      }
    }
  }
}
