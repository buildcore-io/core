import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  Space,
  SpaceClaimRequest,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { WalletService } from '../../services/wallet/wallet';
import { generateRandomAmount } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const claimSpaceControl = async (owner: string, params: SpaceClaimRequest) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const space = await spaceDocRef.get<Space>();
  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }
  if (!space.collectionId || space.claimed) {
    throw invalidArgument(WenError.space_not_claimable);
  }
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${space.collectionId}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  const wallet = await WalletService.newWallet(collection?.mintingData?.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const order: Transaction = {
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
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);

  return order;
};
