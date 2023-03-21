import { COL, MediaStatus, Network, SUB_COL } from '@soonaverse/interfaces';
import Joi from 'joi';
import { get, set } from 'lodash';
import admin from '../../../../admin.config';
import { createSpaceSchema } from '../../../../runtime/firebase/space';
import { downloadMediaAndPackCar } from '../../../../utils/car.utils';
import { getBucket, isProdEnv } from '../../../../utils/config.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../../utils/media.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { spaceToIpfsMetadata } from '../../../../utils/space.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { isStorageUrl } from '../../../joi/common';
import { WalletService } from '../../../wallet/wallet';
import { TransactionService } from '../../transaction-service';

export class SpaceCreateService {
  constructor(readonly transactionService: TransactionService) {}

  public handleSpaceCreateRequest = async (owner: string, request: Record<string, unknown>) => {
    const schema = createSpaceSchema;
    set(schema, 'bannerUrl', Joi.string().uri().optional());
    await assertValidationAsync(Joi.object(schema), request, { allowUnknown: true });

    const { space, guardian, member } = await getCreateSpaceData(owner, request);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
    this.transactionService.updates.push({ ref: spaceDocRef, data: space, action: 'set' });

    const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
    this.transactionService.updates.push({
      ref: spaceGuardianDocRef,
      data: guardian,
      action: 'set',
    });
    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
    this.transactionService.updates.push({
      ref: spaceMemberDocRef,
      data: guardian,
      action: 'set',
    });

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${owner}`);
    this.transactionService.updates.push({
      ref: memberDocRef,
      data: member,
      action: 'update',
      merge: true,
    });

    return { space: space.uid };
  };
}

export const getCreateSpaceData = async (owner: string, params: Record<string, unknown>) => {
  const wallet = await WalletService.newWallet(isProdEnv() ? Network.SMR : Network.RMS);
  const vaultAddress = await wallet.getNewIotaAddressDetails();

  const space = {
    uid: getRandomEthAddress(),
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
      const bucket = admin.storage().bucket(getBucket());
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