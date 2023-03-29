import {
  Award,
  AwardBadge,
  AwardBadgeType,
  COL,
  Network,
  SUB_COL,
  Token,
  TokenStatus,
  WenError,
} from '@soonaverse/interfaces';
import Joi from 'joi';
import { isEmpty, set } from 'lodash';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { soonStorage } from '../../../../firebase/storage/soonStorage';
import { awardBageSchema, createAwardSchema } from '../../../../runtime/firebase/award';
import { downloadMediaAndPackCar } from '../../../../utils/car.utils';
import { getBucket } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../../utils/error.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../../utils/media.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsSpaceMember } from '../../../../utils/space.utils';
import { getTokenBySymbol } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { isStorageUrl } from '../../../joi/common';
import { SmrWallet } from '../../../wallet/SmrWalletService';
import { WalletService } from '../../../wallet/wallet';
import { getAwardgStorageDeposits } from '../../award/award-service';
import { TransactionService } from '../../transaction-service';
import { createAwardFundOrder } from './award.fund.service';

export class AwardCreateService {
  constructor(readonly transactionService: TransactionService) {}

  public handleCreateRequest = async (owner: string, request: Record<string, unknown>) => {
    delete request.requestType;
    const badgeSchema = awardBageSchema;
    set(awardBageSchema, 'image', Joi.string().uri());
    await assertValidationAsync(createAwardSchema(badgeSchema), request);

    const { award, owner: awardOwner } = await createAward(owner, request);

    const awardDocRef = soonDb().doc(`${COL.AWARD}/${award.uid}`);
    this.transactionService.push({
      ref: awardDocRef,
      data: award,
      action: 'set',
    });

    this.transactionService.push({
      ref: awardDocRef.collection(SUB_COL.OWNERS).doc(owner),
      data: awardOwner,
      action: 'set',
    });

    const order = await createAwardFundOrder(owner, award);
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    const response = {
      award: award.uid,
      amount: order.payload.amount,
      address: order.payload.targetAddress,
    };
    if (!isEmpty(order.payload.nativeTokens)) {
      set(response, 'nativeTokens', order.payload.nativeTokens);
    }

    return response;
  };
}

export const createAward = async (owner: string, params: Record<string, unknown>) => {
  await assertIsSpaceMember(params.space as string, owner);

  const awardId = getRandomEthAddress();
  const { tokenSymbol, ...badge } = params.badge as Record<string, unknown>;

  const token = await getTokenBySymbol(tokenSymbol as string);
  if (!token) {
    throw throwInvalidArgument(WenError.token_does_not_exist);
  }
  if (token.mintingData?.network !== params.network) {
    throw throwInvalidArgument(WenError.invalid_network);
  }
  const awardUid = getRandomEthAddress();
  const badgeType = getBadgeType(token);

  if (badge?.image) {
    let imageUrl = badge.image as string;
    if (!isStorageUrl(imageUrl)) {
      const bucket = soonStorage().bucket(getBucket());
      imageUrl = await migrateUriToSotrage(COL.AWARD, owner, awardUid, uriToUrl(imageUrl), bucket);
      set(badge, 'image', imageUrl);
    }
    const ipfs = await downloadMediaAndPackCar(awardId, imageUrl, {});
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
  const wallet = (await WalletService.newWallet(award.network)) as SmrWallet;
  const storageDeposits = await getAwardgStorageDeposits(award, token, wallet);

  const awardOwner = { uid: owner, parentId: award.uid, parentCol: COL.AWARD };

  return { owner: awardOwner, award: { ...award, ...storageDeposits } };
};

const getBadgeType = (token: Token) => {
  if (token.status === TokenStatus.BASE) {
    return AwardBadgeType.BASE;
  }
  if (token.status === TokenStatus.MINTED) {
    return AwardBadgeType.NATIVE;
  }
  throw throwInvalidArgument(WenError.token_in_invalid_status);
};
