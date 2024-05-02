import { database } from '@buildcore/database';
import {
  COL,
  KEY_NAME_TANGLE,
  Network,
  STAMP_COST_PER_MB,
  SUB_COL,
  Space,
  Stamp,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import { AliasAddress, Ed25519Address } from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { packBasicOutput } from '../../../../utils/basic-output.utils';
import { downloadMediaAndPackCar } from '../../../../utils/car.utils';
import { createNftOutput } from '../../../../utils/collection-minting-utils/nft.utils';
import { getProject } from '../../../../utils/common.utils';
import { dateToTimestamp, serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { getRandomBuildcoreUrl, uriToUrl } from '../../../../utils/media.utils';
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
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { stampTangleSchema } from './StampTangleRequestSchema';

export class StampTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
    order: tangleOrder,
    match,
    payment,
    tran,
    tranEntry,
  }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(stampTangleSchema, request);

    const { order, stamp, space } = await createStampAndStampOrder(
      project,
      owner,
      tangleOrder.network,
      params.uri,
      params.days,
      params.aliasId,
    );

    if (!params.aliasId) {
      const spaceDocRef = database().doc(COL.SPACE, space.uid);
      this.transactionService.push({ ref: spaceDocRef, data: space, action: Action.C });

      const guardian = {
        uid: owner,
        parentId: space.uid,
        parentCol: COL.SPACE,
        createdOn: serverTime(),
      };
      const guardianDocRef = database().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner);
      this.transactionService.push({ ref: guardianDocRef, data: guardian, action: Action.C });

      const memberDocRef = database().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner);
      this.transactionService.push({ ref: memberDocRef, data: guardian, action: Action.C });
    }

    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({ ref: orderDocRef, data: order, action: Action.C });

    const stampDocRef = database().doc(COL.STAMP, stamp.uid);
    this.transactionService.push({ ref: stampDocRef, data: stamp, action: Action.C });

    if (match.to.amount < order.payload.amount!) {
      return {
        address: order.payload.targetAddress!,
        amount: order.payload.amount!,
      };
    }

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );
    return {};
  };
}

export const createStampAndStampOrder = async (
  project: string,
  owner: string,
  network: Network,
  uri: string,
  days?: number,
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
  const dailyCost = getStampDailyCost(stamp);
  const order = await createStampOrder(stamp, space, aliasId, days || 0, dailyCost);

  set(stamp, 'order', order.uid);

  return { stamp, order, space };
};

const createStampOrder = async (
  stamp: Stamp,
  space: Space,
  aliasId: string,
  days: number,
  dailyCost: number,
): Promise<Transaction> => {
  const wallet = await WalletService.newWallet(stamp.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const aliasOutputAmount = await getAliasOutputAmount(stamp, space, wallet);
  const nftOutputAmount = await getNftOutputAmount(stamp, aliasId, wallet);

  const royaltyOutput = await packBasicOutput(wallet, targetAddress.bech32, 0, {});
  const storageDeposit = aliasOutputAmount + nftOutputAmount;
  const amount = Math.max(days * dailyCost, Number(royaltyOutput.amount)) + storageDeposit;

  const order = {
    project: getProject(stamp),
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: stamp.createdBy,
    space: space.uid,
    network: stamp.network,
    payload: {
      type: TransactionPayloadType.STAMP,
      amount,
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
      dailyCost,
    },
    linkedTransactions: [],
  };
  if (days) {
    set(order, 'payload.days', days);
  }
  return order;
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
  const guardianDocRef = database().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, stamp.createdBy);
  const guardian = await guardianDocRef.get();

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
  buildcoreUrl:
    stamp.build5Url || getRandomBuildcoreUrl(stamp.createdBy!, stamp.uid, stamp.extension),
  checksum: stamp.checksum,
  issuerName: KEY_NAME_TANGLE,
  originId: stamp.uid,
});

export const getStampDailyCost = (stamp: Stamp) =>
  Math.ceil((stamp.bytes / (1024 * 1024)) * STAMP_COST_PER_MB);
