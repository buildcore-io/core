import { Award, AwardBadgeType, MediaStatus, Network } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgAward } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class AwardConverter implements Converter<Award, PgAward> {
  toPg = (award: Award): PgAward => ({
    uid: award.uid,
    project: award.project,
    createdOn: award.createdOn?.toDate(),
    updatedOn: award.updatedOn?.toDate(),
    createdBy: award.createdBy,

    name: award.name,
    description: award.description,
    space: award.space,
    endDate: award.endDate?.toDate(),
    issued: award.issued,
    badgesMinted: award.badgesMinted,
    approved: award.approved,
    rejected: award.rejected,
    completed: award.completed,
    network: award.network,
    aliasStorageDeposit: award.aliasStorageDeposit,
    collectionStorageDeposit: award.collectionStorageDeposit,
    nttStorageDeposit: award.nttStorageDeposit,
    nativeTokenStorageDeposit: award.nativeTokenStorageDeposit,
    funded: award.funded,
    fundingAddress: award.fundingAddress,
    fundedBy: award.fundedBy,
    address: award.address,
    airdropClaimed: award.airdropClaimed,
    aliasBlockId: award.aliasBlockId,
    aliasId: award.aliasId,
    collectionBlockId: award.collectionBlockId,
    collectionId: award.collectionId,
    mediaStatus: award.mediaStatus,
    mediaUploadErrorCount: award.mediaUploadErrorCount,
    isLegacy: award.isLegacy,
    badge_name: award.badge.name,
    badge_description: award.badge?.description,
    badge_total: award.badge?.total,
    badge_type: award.badge?.type,
    badge_tokenReward: award.badge?.tokenReward,
    badge_tokenUid: award.badge?.tokenUid,
    badge_tokenId: award.badge?.tokenId,
    badge_tokenSymbol: award.badge?.tokenSymbol,
    badge_image: award.badge?.image,
    badge_ipfsMedia: award.badge?.ipfsMedia,
    badge_ipfsMetadata: award.badge?.ipfsMetadata,
    badge_ipfsRoot: award.badge?.ipfsRoot,
    badge_lockTime: award.badge?.lockTime,
  });

  fromPg = (pg: PgAward): Award =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      name: pg.name || '',
      description: pg.description || '',
      space: pg.space || '',
      endDate: pgDateToTimestamp(pg.endDate)!,
      badge: {
        name: pg.badge_name!,
        description: pg.badge_description!,
        total: pg.badge_total!,
        type: pg.badge_type as AwardBadgeType,
        tokenReward: pg.badge_tokenReward!,
        tokenUid: pg.badge_tokenUid!,
        tokenId: pg.badge_tokenId,
        tokenSymbol: pg.badge_tokenSymbol!,
        image: pg.badge_image,
        ipfsMedia: pg.badge_ipfsMedia,
        ipfsMetadata: pg.badge_ipfsMetadata,
        ipfsRoot: pg.badge_ipfsRoot,
        lockTime: pg.badge_lockTime || 0,
      },

      issued: pg.issued!,
      badgesMinted: pg.badgesMinted!,
      approved: pg.approved!,
      rejected: pg.rejected!,
      completed: pg.completed!,
      network: (pg.network as Network)!,
      aliasStorageDeposit: pg.aliasStorageDeposit!,
      collectionStorageDeposit: pg.collectionStorageDeposit!,
      nttStorageDeposit: pg.nttStorageDeposit!,
      nativeTokenStorageDeposit: pg.nativeTokenStorageDeposit!,
      funded: pg.funded!,
      fundedBy: pg.fundedBy,
      fundingAddress: pg.fundingAddress,
      address: pg.address,
      airdropClaimed: pg.airdropClaimed,
      aliasBlockId: pg.aliasBlockId,
      aliasId: pg.aliasId,
      collectionBlockId: pg.collectionBlockId,
      collectionId: pg.collectionId,
      mediaStatus: pg.mediaStatus as MediaStatus,
      mediaUploadErrorCount: pg.mediaUploadErrorCount,
      isLegacy: pg.isLegacy,
    });
}
