import { build5Db, build5Storage } from '@build-5/database';
import {
  COL,
  MediaStatus,
  Network,
  SUB_COL,
  SpaceCreateTangleResponse,
  SpaceGuardian,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { downloadMediaAndPackCar } from '../../../../utils/car.utils';
import { getBucket, isProdEnv } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../../utils/media.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { spaceToIpfsMetadata } from '../../../../utils/space.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { isStorageUrl } from '../../../joi/common';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { createSpaceSchemaObject } from './SpaceCreateTangleRequestSchema';

export class SpaceCreateService extends BaseTangleService<SpaceCreateTangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<SpaceCreateTangleResponse> => {
    await assertValidationAsync(createSpaceSchemaObject, request);

    const { space, guardian } = await getCreateSpaceData(project, owner, request);

    this.transactionService.push({
      ref: build5Db().doc(COL.SPACE, space.uid),
      data: space,
      action: Action.C,
    });

    this.transactionService.push({
      ref: build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner),
      data: guardian,
      action: Action.C,
    });
    this.transactionService.push({
      ref: build5Db().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner),
      data: guardian,
      action: Action.C,
    });

    const memberDocRef = build5Db().doc(COL.MEMBER, owner);
    this.transactionService.push({
      ref: memberDocRef,
      data: { spaces: { [space.uid]: { uid: space.uid, isMember: true } } },
      action: Action.U,
    });

    return { space: space.uid };
  };
}

export const getCreateSpaceData = async (
  project: string,
  owner: string,
  params: Record<string, unknown>,
) => {
  const wallet = await WalletService.newWallet(isProdEnv() ? Network.SMR : Network.RMS);
  const vaultAddress = await wallet.getNewIotaAddressDetails();

  const space = {
    uid: getRandomEthAddress(),
    project,
    ...params,
    bannerUrl: (params.bannerUrl as string) || '',
    createdBy: owner,
    open: params.open === false ? false : true,
    totalMembers: 1,
    totalGuardians: 1,
    totalPendingMembers: 0,
    rank: 1,
    vaultAddress: vaultAddress.bech32,
  };

  let bannerUrl = space.bannerUrl || '';
  if (bannerUrl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = spaceToIpfsMetadata(space as any);

    if (!isStorageUrl(bannerUrl)) {
      const bucket = build5Storage().bucket(getBucket());
      bannerUrl = await migrateUriToSotrage(
        COL.SPACE,
        owner,
        space.uid,
        uriToUrl(bannerUrl),
        bucket,
      );
      set(space, 'bannerUrl', bannerUrl);
    }

    const ipfs = await downloadMediaAndPackCar(space.uid, bannerUrl, metadata);
    set(space, 'ipfsMedia', ipfs.ipfsMedia);
    set(space, 'ipfsMetadata', ipfs.ipfsMetadata);
    set(space, 'ipfsRoot', ipfs.ipfsRoot);
    set(space, 'mediaStatus', MediaStatus.PENDING_UPLOAD);
  }

  const guardian: SpaceGuardian = {
    project,
    uid: owner,
    parentId: space.uid,
    parentCol: COL.SPACE,
    createdOn: dateToTimestamp(dayjs()),
  };

  return {
    space: { ...space, guardians: { [owner]: guardian }, members: { [owner]: guardian } },
    guardian,
  };
};
