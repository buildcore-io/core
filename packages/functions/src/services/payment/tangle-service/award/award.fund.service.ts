import {
  Award,
  AwardBadgeType,
  COL,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import admin from '../../../../admin.config';
import { uidSchema } from '../../../../runtime/firebase/common';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet';
import { TransactionService } from '../../transaction-service';

export class AwardFundService {
  constructor(readonly transactionService: TransactionService) {}

  public handleFundRequest = async (owner: string, request: Record<string, unknown>) => {
    delete request.requestType;
    await assertValidationAsync(uidSchema, request);

    const award = await getAwardForFunding(owner, request.uid as string);
    const order = await createAwardFundOrder(owner, award);
    const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.updates.push({ ref: orderDocRef, data: order, action: 'set' });

    const response = {
      amount: order.payload.amount,
      address: order.payload.targetAddress,
    };
    if (!isEmpty(order.payload.nativeTokens)) {
      set(response, 'nativeTokens', order.payload.nativeTokens);
    }

    return response;
  };
}

export const createAwardFundOrder = async (owner: string, award: Award) => {
  const isNativeBadge = award.badge.type === AwardBadgeType.NATIVE;
  const amount =
    award.aliasStorageDeposit +
    award.collectionStorageDeposit +
    award.nttStorageDeposit +
    award.nativeTokenStorageDeposit;
  const totalReward = award.badge.total * award.badge.tokenReward;

  const wallet = await WalletService.newWallet(award.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const nativeTokens = [{ id: award.badge.tokenId, amount: totalReward }];
  return <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: award.space,
    network: award.network,
    payload: {
      type: TransactionOrderType.FUND_AWARD,
      amount: isNativeBadge ? amount : amount + totalReward,
      nativeTokens: isNativeBadge && totalReward ? nativeTokens : [],
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      award: award.uid,
    },
  };
};

export const getAwardForFunding = async (owner: string, awardId: string) => {
  const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${awardId}`);
  const award = <Award | undefined>(await awardDocRef.get()).data();

  if (!award) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  if (award.funded) {
    throw throwInvalidArgument(WenError.award_is_already_approved);
  }

  if (award.isLegacy) {
    throw throwInvalidArgument(WenError.legacy_award);
  }

  await assertIsGuardian(award.space, owner);

  return award;
};