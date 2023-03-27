import {
  COL,
  Collection,
  Space,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../database/wrapper/soondb';
import { WalletService } from '../../services/wallet/wallet';
import { generateRandomAmount } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const claimSpaceControl = async (owner: string, params: Record<string, unknown>) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${params.space}`);
  const space = await spaceDocRef.get<Space>();
  if (!space) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }
  if (!space.collectionId || space.claimed) {
    throw throwInvalidArgument(WenError.space_not_claimable);
  }
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${space.collectionId}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  const wallet = await WalletService.newWallet(collection?.mintingData?.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const order = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: space?.uid || null,
    network: collection?.mintingData?.network,
    payload: {
      type: TransactionOrderType.CLAIM_SPACE,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
    },
    linkedTransactions: [],
  };
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);

  return order;
};
