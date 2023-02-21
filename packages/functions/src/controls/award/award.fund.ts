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
import { Database } from '../../database/Database';
import { WalletService } from '../../services/wallet/wallet';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const fundAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const award = await Database.getById<Award>(COL.AWARD, params.uid as string);
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

  const isNativeBadge = award.badge.type === AwardBadgeType.NATIVE;
  const amount =
    award.aliasStorageDeposit +
    award.collectionStorageDeposit +
    award.nttStorageDeposit +
    award.nativeTokenStorageDeposit;
  const totalReward = award.badge.total * award.badge.tokenReward;

  const wallet = await WalletService.newWallet(award.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const order = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: award.space,
    network: award.network,
    payload: {
      type: TransactionOrderType.FUND_AWARD,
      amount: isNativeBadge ? amount : amount + totalReward,
      nativeTokens: isNativeBadge ? [{ id: award.badge.tokenId, amount: totalReward }] : [],
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      award: award.uid,
    },
  };

  await Database.create(COL.TRANSACTION, order);
  return order;
};
