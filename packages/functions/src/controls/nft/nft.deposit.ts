import {
  COL,
  Network,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../database/wrapper/soondb';
import { WalletService } from '../../services/wallet/wallet';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const depositNftControl = async (owner: string, params: Record<string, unknown>) => {
  const network = params.network as Network;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const order = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: '',
    network,
    payload: {
      type: TransactionOrderType.DEPOSIT_NFT,
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS,
      expiresOn: dateToTimestamp(
        dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
      ),
      reconciled: false,
      void: false,
    },
  };
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);
  return order;
};
