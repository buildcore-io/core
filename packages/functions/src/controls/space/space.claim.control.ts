import { database } from '@buildcore/database';
import {
  COL,
  SpaceClaimRequest,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { WalletService } from '../../services/wallet/wallet.service';
import { generateRandomAmount } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const claimSpaceControl = async ({ owner, params, project }: Context<SpaceClaimRequest>) => {
  const spaceDocRef = database().doc(COL.SPACE, params.uid);
  const space = await spaceDocRef.get();
  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }
  if (!space.collectionId || space.claimed) {
    throw invalidArgument(WenError.space_not_claimable);
  }
  const collectionDocRef = database().doc(COL.COLLECTION, space.collectionId);
  const collection = await collectionDocRef.get();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  const wallet = await WalletService.newWallet(collection?.mintingData?.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const order: Transaction = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: space?.uid || '',
    network: collection?.mintingData?.network!,
    payload: {
      type: TransactionPayloadType.CLAIM_SPACE,
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
  const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
  await orderDocRef.create(order);

  return order;
};
