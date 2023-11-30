import { build5Db } from '@build-5/database';
import {
  COL,
  KEY_NAME_TANGLE,
  Network,
  STAMP_COST_PER_MB,
  SUB_COL,
  Space,
  SpaceGuardian,
  Stamp,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import { AliasAddress, Ed25519Address } from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { downloadMediaAndPackCar } from '../../../../utils/car.utils';
import { createNftOutput } from '../../../../utils/collection-minting-utils/nft.utils';
import { generateRandomAmount, getProject } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { getRandomBuild5Url, uriToUrl } from '../../../../utils/media.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getSpaceByAliasId } from '../../../../utils/space.utils';
import {
  EMPTY_ALIAS_ID,
  createAliasOutput,
} from '../../../../utils/token-minting-utils/alias.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { isStorageUrl } from '../../../joi/common';
import { Wallet } from '../../../wallet/wallet';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseService, HandlerParams } from '../../base';
import { stampTangleSchema } from './StampTangleRequestSchema';

export class StampTangleService extends BaseService {
  public handleRequest = async ({ project, owner, request, order: tangleOrder }: HandlerParams) => {
    const params = await assertValidationAsync(stampTangleSchema, request);

    const { order, stamp, space } = await createStampAndStampOrder(
      project,
      owner,
      tangleOrder.network,
      params.uri,
      params.aliasId,
    );

    if (!params.aliasId) {
      const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
      this.transactionService.push({ ref: spaceDocRef, data: space, action: 'set' });

      const guardian = { uid: owner, parentId: space.uid, parentCol: COL.SPACE };
      const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
      this.transactionService.push({ ref: guardianDocRef, data: guardian, action: 'set' });

      const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
      this.transactionService.push({ ref: memberDocRef, data: guardian, action: 'set' });
    }

    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    const stampDocRef = build5Db().doc(`${COL.STAMP}/${stamp.uid}`);
    this.transactionService.push({ ref: stampDocRef, data: stamp, action: 'set' });

    return {
      address: order.payload.targetAddress!,
      dailyCost: getStampDailyCost(stamp),
      stamp: stamp.uid,
      amountToMint: order.payload.aliasOutputAmount! + order.payload.nftOutputAmount!,
    };
  };
}

export const createStampAndStampOrder = async (
  project: string,
  owner: string,
  network: Network,
  uri: string,
  aliasId = EMPTY_ALIAS_ID,
) => {
  const stampUid = getRandomEthAddress();

  const url = uriToUrl(uri);
  const car = await downloadMediaAndPackCar(stampUid, url);

  const space = await getSpace(project, owner, aliasId);
  const stamp: Stamp = {
    project: project,
    uid: getRandomEthAddress(),
    space: space.uid,
    createdBy: owner,

    build5Url: isStorageUrl(url) ? url : '',
    originUri: url,
    checksum: car.hash,
    bytes: car.bytes,
    costPerMb: STAMP_COST_PER_MB,
    extension: car.extension,

    network,

    expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
    order: '',
    funded: false,
    expired: false,

    ipfsMedia: car.ipfsMedia,
    aliasId,
  };

  const order = await createStampOrder(stamp, space, aliasId);

  set(stamp, 'order', order.uid);

  return { stamp, order, space };
};

const createStampOrder = async (
  stamp: Stamp,
  space: Space,
  aliasId: string,
): Promise<Transaction> => {
  const wallet = await WalletService.newWallet(stamp.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const aliasOutputAmount = await getAliasOutputAmount(stamp, space, wallet);
  const nftOutputAmount = await getNftOutputAmount(stamp, aliasId, wallet);

  return {
    project: getProject(stamp),
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: stamp.createdBy,
    space: space.uid,
    network: stamp.network,
    payload: {
      type: TransactionPayloadType.STAMP,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(100, 'y')),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      chainReference: null,
      stamp: stamp.uid,
      aliasOutputAmount,
      aliasId: aliasId === EMPTY_ALIAS_ID ? '' : aliasId,
      nftOutputAmount,
    },
    linkedTransactions: [],
  };
};

const getSpace = async (project: string, owner: string, aliasId: string) => {
  if (aliasId === EMPTY_ALIAS_ID) {
    return {
      project,
      uid: getRandomEthAddress(),
      name: `Space of alias: ${aliasId}`,
      open: false,
      createdBy: owner,
      totalGuardians: 1,
      totalMembers: 1,
      totalPendingMembers: 0,
      guardians: {},
      members: {},
    };
  }
  const space = await getSpaceByAliasId(aliasId);
  if (!space || !space.alias?.address) {
    throw invalidArgument(WenError.alias_not_deposited);
  }
  return space;
};

const getAliasOutputAmount = async (stamp: Stamp, space: Space, wallet: Wallet) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  if (isEmpty(space.alias)) {
    const aliasOutput = await createAliasOutput(wallet, targetAddress);
    return Number(aliasOutput.amount);
  }

  if (!space.alias?.address) {
    throw invalidArgument(WenError.not_alias_governor);
  }
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(stamp.createdBy);
  const guardian = await guardianDocRef.get<SpaceGuardian>();

  if (!guardian) {
    throw invalidArgument(WenError.not_alias_governor);
  }

  return 0;
};

const getNftOutputAmount = async (stamp: Stamp, aliasId: string, wallet: Wallet) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const issuerAddress = new AliasAddress(aliasId);
  const ownerAddress = new Ed25519Address(targetAddress.hex);
  const output = await createNftOutput(
    wallet,
    ownerAddress,
    issuerAddress,
    JSON.stringify(stampToNftMetadata(stamp)),
  );
  return Number(output.amount);
};

export const stampToNftMetadata = (stamp: Stamp) => ({
  originUri: stamp.originUri,
  uri: 'ipfs://' + stamp.ipfsMedia,
  build5Url: stamp.build5Url || getRandomBuild5Url(stamp.createdBy!, stamp.uid, stamp.extension),
  checksum: stamp.checksum,
  issuerName: KEY_NAME_TANGLE,
  build5Id: stamp.uid,
});

export const getStampDailyCost = (stamp: Stamp) =>
  Math.ceil((stamp.bytes / (1024 * 1024)) * STAMP_COST_PER_MB);
