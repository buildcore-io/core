import { database } from '@buildcore/database';
import {
  Award,
  AwardBadgeType,
  COL,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { awardFundSchema } from './AwardFundTangleRequestSchema';

export class AwardFundService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ project, owner, request }: HandlerParams) => {
    const params = await assertValidationAsync(awardFundSchema, request);

    const award = await getAwardForFunding(owner, params.uid);
    const order = await createAwardFundOrder(project, owner, award);
    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({ ref: orderDocRef, data: order, action: Action.C });

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

export const createAwardFundOrder = async (
  project: string,
  owner: string,
  award: Award,
): Promise<Transaction> => {
  const isNativeBadge = award.badge.type === AwardBadgeType.NATIVE;
  const amount =
    award.aliasStorageDeposit +
    award.collectionStorageDeposit +
    award.nttStorageDeposit +
    award.nativeTokenStorageDeposit;
  const totalReward = award.badge.total * award.badge.tokenReward;

  const wallet = await WalletService.newWallet(award.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const nativeTokens = [{ id: award.badge.tokenId!, amount: BigInt(totalReward) }];
  return {
    project,
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
  const awardDocRef = database().doc(COL.AWARD, awardId);
  const award = await awardDocRef.get();

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
