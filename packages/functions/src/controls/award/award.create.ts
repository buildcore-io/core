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
import { set } from 'lodash';
import { Database } from '../../database/Database';
import { getAwardgStorageDeposits } from '../../services/payment/award/award-service';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { downloadMediaAndPackCar } from '../../utils/car.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsSpaceMember } from '../../utils/space.utils';
import { getTokenBySymbol } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const createAwardControl = async (owner: string, params: Record<string, unknown>) => {
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
  const badgeType = getBadgeType(token);

  if (badge?.image) {
    const ipfs = await downloadMediaAndPackCar(awardId, badge.image as string, {});
    set(badge, 'ipfsMedia', ipfs.ipfsMedia);
    set(badge, 'ipfsMetadata', ipfs.ipfsMetadata);
    set(badge, 'ipfsRoot', ipfs.ipfsRoot);
  }

  const batchWriter = Database.createBatchWriter();

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
    uid: getRandomEthAddress(),
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
  batchWriter.set(COL.AWARD, { ...award, ...storageDeposits });

  const awardOwner = { uid: owner, parentId: award.uid, parentCol: COL.AWARD };
  batchWriter.set(COL.AWARD, awardOwner, SUB_COL.OWNERS, award.uid);

  await batchWriter.commit();

  return await Database.getById<Award>(COL.AWARD, award.uid);
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
