import { build5Db } from '@build-5/database';
import {
  Award,
  AwardBadgeType,
  BaseTangleResponse,
  COL,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet';
import { TransactionService } from '../../transaction-service';
import { awardFundSchema } from './AwardFundTangleRequestSchema';

export class AwardFundService {
  constructor(readonly transactionService: TransactionService) {}

  public handleFundRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse> => {
    const params = await assertValidationAsync(awardFundSchema, request);

    const award = await getAwardForFunding(owner, params.uid);
    const order = await createAwardFundOrder(owner, award);
    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    const response = {
      amount: order.payload.amount!,
      address: order.payload.targetAddress!,
    };
    if (!isEmpty(order.payload.nativeTokens)) {
      set(response, 'nativeTokens', order.payload.nativeTokens);
    }

    return response;
  };
}

export const createAwardFundOrder = async (owner: string, award: Award): Promise<Transaction> => {
  const isNativeBadge = award.badge.type === AwardBadgeType.NATIVE;
  const amount =
    award.aliasStorageDeposit +
    award.collectionStorageDeposit +
    award.nttStorageDeposit +
    award.nativeTokenStorageDeposit;
  const totalReward = award.badge.total * award.badge.tokenReward;

  const wallet = await WalletService.newWallet(award.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const nativeTokens = [{ id: award.badge.tokenId!, amount: totalReward.toString() }];
  return {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: award.space,
    network: award.network,
    payload: {
      type: TransactionPayloadType.FUND_AWARD,
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
  const awardDocRef = build5Db().doc(`${COL.AWARD}/${awardId}`);
  const award = await awardDocRef.get<Award>();

  if (!award) {
    throw invalidArgument(WenError.award_does_not_exists);
  }

  if (award.funded) {
    throw invalidArgument(WenError.award_is_already_approved);
  }

  if (award.isLegacy) {
    throw invalidArgument(WenError.legacy_award);
  }

  await assertIsGuardian(award.space, owner);

  return award;
};
