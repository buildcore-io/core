import { build5Db, build5Storage } from '@build-5/database';
import { COL, MediaStatus, Network, SUB_COL, SpaceCreateTangleResponse } from '@build-5/interfaces';
import { get, set } from 'lodash';
import { downloadMediaAndPackCar } from '../../../../utils/car.utils';
import { getBucket, isProdEnv } from '../../../../utils/config.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../../utils/media.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { spaceToIpfsMetadata } from '../../../../utils/space.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { isStorageUrl } from '../../../joi/common';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { createSpaceSchemaObject } from './SpaceCreateTangleRequestSchema';

export class SpaceCreateService extends BaseTangleService<SpaceCreateTangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<SpaceCreateTangleResponse> => {
    await assertValidationAsync(createSpaceSchemaObject, request);

    const { space, guardian, member } = await getCreateSpaceData(project, owner, request);

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
    this.transactionService.push({ ref: spaceDocRef, data: space, action: 'set' });

    const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
    this.transactionService.push({
      ref: spaceGuardianDocRef,
      data: guardian,
      action: 'set',
    });
    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
    this.transactionService.push({
      ref: spaceMemberDocRef,
      data: guardian,
      action: 'set',
    });

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
    this.transactionService.push({
      ref: memberDocRef,
      data: member,
      action: 'update',
      merge: true,
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
    createdBy: owner,
    open: params.open === false ? false : true,
    totalMembers: 1,
    totalGuardians: 1,
    totalPendingMembers: 0,
    rank: 1,
    vaultAddress: vaultAddress.bech32,
  };

  let bannerUrl = get(space, 'bannerUrl', '');
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

  const guardian = {
    project,
    uid: owner,
    parentId: space.uid,
    parentCol: COL.SPACE,
  };

  return {
    space: { ...space, guardians: { [owner]: guardian }, members: { [owner]: guardian } },
    guardian,
    member: { spaces: { [space.uid]: { uid: space.uid, isMember: true } } },
  };
};
