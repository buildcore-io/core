import { build5Db } from '@build-5/database';
import {
  COL,
  Network,
  NftDepositRequest,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { Context } from '../../runtime/firebase/common';
import { WalletService } from '../../services/wallet/wallet';
import { getProjects } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const depositNftControl = async ({ project, owner }: Context, params: NftDepositRequest) => {
  const network = params.network as Network;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const order: Transaction = {
    project,
    projects: getProjects([], project),
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
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);
  return order;
};
