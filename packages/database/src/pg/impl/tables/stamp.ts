import { MediaStatus, Network, Stamp } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgStamp } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class StampConverter implements Converter<Stamp, PgStamp> {
  toPg = (stamp: Stamp): PgStamp => ({
    uid: stamp.uid,
    project: stamp.project,
    createdOn: stamp.createdOn?.toDate(),
    updatedOn: stamp.updatedOn?.toDate(),
    createdBy: stamp.createdBy,

    space: stamp.space,
    build5Url: stamp.build5Url,
    originUri: stamp.originUri,
    checksum: stamp.checksum,
    extension: stamp.extension,
    bytes: stamp.bytes,
    costPerMb: stamp.costPerMb,
    network: stamp.network,
    ipfsMedia: stamp.ipfsMedia,
    ipfsRoot: stamp.ipfsRoot,
    expiresAt: stamp.expiresAt.toDate(),
    order: stamp.order,
    funded: stamp.funded,
    expired: stamp.expired,
    mediaStatus: stamp.mediaStatus,
    mediaUploadErrorCount: stamp.mediaUploadErrorCount,
    nftId: stamp.nftId,
    aliasId: stamp.aliasId,
  });

  fromPg = (pg: PgStamp): Stamp =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      space: pg.space!,
      build5Url: pg.build5Url!,
      originUri: pg.originUri!,
      checksum: pg.checksum!,
      extension: pg.extension!,
      bytes: pg.bytes!,
      costPerMb: pg.costPerMb!,
      network: pg.network as Network,
      ipfsMedia: pg.ipfsMedia,
      ipfsRoot: pg.ipfsRoot,
      expiresAt: pgDateToTimestamp(pg.expiresAt)!,
      order: pg.order!,
      funded: pg.funded!,
      expired: pg.expired!,
      mediaStatus: pg.mediaStatus as MediaStatus,
      mediaUploadErrorCount: pg.mediaUploadErrorCount,
      aliasId: pg.aliasId,
      nftId: pg.nftId,
    });
}
