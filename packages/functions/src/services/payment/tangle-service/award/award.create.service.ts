import { database, storage } from '@buildcore/database';
import {
  Award,
  AwardBadge,
  AwardBadgeType,
  AwardCreateRequest,
  AwardCreateTangleRequest,
  AwardCreateTangleResponse,
  AwardOwner,
  COL,
  Network,
  SUB_COL,
  Token,
  TokenStatus,
  WenError,
} from '@buildcore/interfaces';
import { isEmpty, set } from 'lodash';
import { downloadMediaAndPackCar } from '../../../../utils/car.utils';
import { getBucket } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../../utils/media.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsSpaceMember } from '../../../../utils/space.utils';
import { getTokenBySymbol } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { isStorageUrl } from '../../../joi/common';
import { WalletService } from '../../../wallet/wallet.service';
import { getAwardgStorageDeposits } from '../../award/award-service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { awardCreateSchema } from './AwardCreateTangleRequestSchema';
import { createAwardFundOrder } from './award.fund.service';

export class AwardCreateService extends BaseTangleService<AwardCreateTangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<AwardCreateTangleResponse> => {
    const params = await assertValidationAsync(awardCreateSchema, request);
    const { award, owner: awardOwner } = await createAward(project, owner, { ...params });

    const awardDocRef = database().doc(COL.AWARD, award.uid);
    this.transactionService.push({
      ref: awardDocRef,
      data: award,
      action: Action.C,
    });

    this.transactionService.push({
      ref: database().doc(COL.AWARD, award.uid, SUB_COL.OWNERS, owner),
      data: awardOwner,
      action: Action.C,
    });

    const order = await createAwardFundOrder(project, owner, award);
    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({ ref: orderDocRef, data: order, action: Action.C });

    const response = {
      award: award.uid,
      amount: order.payload.amount!,
      address: order.payload.targetAddress!,
    };
    if (!isEmpty(order.payload.nativeTokens)) {
      set(response, 'nativeTokens', order.payload.nativeTokens!);
    }

    return response;
  };
}

export const createAward = async (
  project: string,
  owner: string,
  params: AwardCreateRequest | AwardCreateTangleRequest,
): Promise<{
  owner: AwardOwner;
  award: Award;
}> => {
  await assertIsSpaceMember(params.space as string, owner);

  const awardId = getRandomEthAddress();
  const { tokenSymbol, ...badge } = params.badge!;

  const token = await getTokenBySymbol(tokenSymbol as string);
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }
  if (token.mintingData?.network !== params.network) {
    throw invalidArgument(WenError.invalid_network);
  }
  const awardUid = getRandomEthAddress();
  const badgeType = getBadgeType(token);

  if (badge?.image) {
    let imageUrl = badge.image;
    if (!isStorageUrl(imageUrl)) {
      const bucket = storage().bucket(getBucket());
      imageUrl = await migrateUriToSotrage(COL.AWARD, owner, awardUid, uriToUrl(imageUrl), bucket);
      set(badge, 'image', imageUrl);
    }
    const ipfs = await downloadMediaAndPackCar(awardId, imageUrl);
    set(badge, 'ipfsMedia', ipfs.ipfsMedia);
    set(badge, 'ipfsMetadata', ipfs.ipfsMetadata);
    set(badge, 'ipfsRoot', ipfs.ipfsRoot);
  }

  const awardBadge = {
    ...badge,
    type: badgeType,
    tokenUid: token.uid,
    tokenSymbol: token.symbol,
  };
  if (awardBadge.type === AwardBadgeType.NATIVE) {
    set(awardBadge, 'tokenId', token.mintingData?.tokenId);
  }
  const award: Award = {
    project,
    createdBy: owner,
    uid: awardUid,
    name: params.name as string,
    description: params.description as string,
    space: params.space as string,
    endDate: dateToTimestamp(params.endDate as Date, true),
    badge: awardBadge as AwardBadge,
    issued: 0,
    badgesMinted: 0,
    approved: false,
    rejected: false,
    completed: false,
    network: params.network as Network,
    aliasStorageDeposit: 0,
    collectionStorageDeposit: 0,
    nttStorageDeposit: 0,
    nativeTokenStorageDeposit: 0,
    funded: false,
  };
  const wallet = await WalletService.newWallet(award.network);
  const storageDeposits = await getAwardgStorageDeposits(award, token, wallet);

  const awardOwner: AwardOwner = {
    uid: owner,
    project,
    parentId: award.uid,
    parentCol: COL.AWARD,
  };

  return { owner: awardOwner, award: { ...award, ...storageDeposits } };
};

const getBadgeType = (token: Token) => {
  if (token.status === TokenStatus.BASE) {
    return AwardBadgeType.BASE;
  }
  if (token.status === TokenStatus.MINTED) {
    return AwardBadgeType.NATIVE;
  }
  throw invalidArgument(WenError.token_in_invalid_status);
};
