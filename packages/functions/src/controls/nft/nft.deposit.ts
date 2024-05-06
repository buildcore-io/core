import { database } from '@buildcore/database';
import {
  COL,
  Network,
  NftDepositRequest,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { WalletService } from '../../services/wallet/wallet.service';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const depositNftControl = async ({
  owner,
  params,
  project,
}: Context<NftDepositRequest>): Promise<Transaction> => {
  const network = params.network as Network;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const order: Transaction = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: '',
    network,
    payload: {
      amount: 0,
      type: TransactionPayloadType.DEPOSIT_NFT,
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      reconciled: false,
      void: false,
    },
  };
  const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
  await orderDocRef.create(order);
  return order;
};
