import {
  AddressTypes,
  ALIAS_ADDRESS_TYPE,
  ED25519_ADDRESS_TYPE,
  INftAddress,
  NFT_ADDRESS_TYPE,
} from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import {
  Award,
  AwardBadge,
  AwardBadgeType,
  COL,
  Network,
  Space,
  SUB_COL,
  Token,
  TokenStatus,
  WenError,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { set } from 'lodash';
import admin from '../../admin.config';
import { Database } from '../../database/Database';
import {
  awardBadgeToNttMetadata,
  awardToCollectionMetadata,
} from '../../services/payment/award/award-service';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { downloadMediaAndPackCar } from '../../utils/car.utils';
import { createNftOutput } from '../../utils/collection-minting-utils/nft.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsSpaceMember } from '../../utils/space.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
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

  const storageDeposits = await getBaseTokensCount(award, token);
  batchWriter.set(COL.AWARD, { ...award, ...storageDeposits });

  const awardOwner = { uid: owner, parentId: award.uid, parentCol: COL.AWARD };
  batchWriter.set(COL.AWARD, awardOwner, SUB_COL.OWNERS, award.uid);

  await batchWriter.commit();

  return await Database.getById<Award>(COL.AWARD, award.uid);
};

const getBaseTokensCount = async (award: Award, token: Token) => {
  const wallet = (await WalletService.newWallet(award.network)) as SmrWallet;
  const address = await wallet.getNewIotaAddressDetails();

  const aliasOutput = createAliasOutput(address, wallet.info);

  const collectioIssuerAddress: AddressTypes = {
    type: ALIAS_ADDRESS_TYPE,
    aliasId: aliasOutput.aliasId,
  };

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${award.space}`);
  const space = <Space>(await spaceDocRef.get()).data();

  const collectionMetadata = await awardToCollectionMetadata(award, space);
  const collectionOutput = createNftOutput(
    collectioIssuerAddress,
    collectioIssuerAddress,
    JSON.stringify(collectionMetadata),
    wallet.info,
  );

  const nttMetadata = await awardBadgeToNttMetadata(
    award,
    collectionOutput.nftId,
    getRandomEthAddress(),
    dayjs(),
    0,
  );
  const issuerAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: collectionOutput.nftId };
  const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex };
  const ntt = createNftOutput(
    ownerAddress,
    issuerAddress,
    JSON.stringify(nttMetadata),
    wallet.info,
    dayjs().add(100, 'y'),
  );

  const storageDeposit = {
    aliasStorageDeposit: Number(aliasOutput.amount),
    collectionStorageDeposit: Number(collectionOutput.amount),
    nttStorageDeposit: Number(ntt.amount) * award.badge.total,
    nativeTokenStorageDeposit: 0,
  };

  if (award.badge.type === AwardBadgeType.NATIVE) {
    const nativeTokenAmount = award.badge.total * award.badge.tokenReward;
    const nativeToken = {
      id: token?.mintingData?.tokenId!,
      amount: HexHelper.fromBigInt256(bigInt(nativeTokenAmount)),
    };
    const nativeTokenOutput = packBasicOutput(address.bech32, 0, [nativeToken], wallet.info);
    storageDeposit.nativeTokenStorageDeposit = Number(nativeTokenOutput.amount);
  }

  return storageDeposit;
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
