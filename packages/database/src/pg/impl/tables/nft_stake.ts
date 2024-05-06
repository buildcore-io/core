import { NftStake, StakeType } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgNftStake } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class NftStakeConverter implements Converter<NftStake, PgNftStake> {
  toPg = (nftStake: NftStake): PgNftStake => ({
    uid: nftStake.uid,
    project: nftStake.project,
    createdOn: nftStake.createdOn?.toDate(),
    updatedOn: nftStake.updatedOn?.toDate(),
    createdBy: nftStake.createdBy,
    member: nftStake.member,
    space: nftStake.space,
    collection: nftStake.collection,
    nft: nftStake.nft,
    weeks: nftStake.weeks,
    expiresAt: nftStake.expiresAt?.toDate(),
    expirationProcessed: nftStake.expirationProcessed,
    type: nftStake.type,
  });

  fromPg = (nftStake: PgNftStake): NftStake =>
    removeNulls({
      uid: nftStake.uid,
      project: nftStake.project,
      createdOn: pgDateToTimestamp(nftStake.createdOn),
      updatedOn: pgDateToTimestamp(nftStake.updatedOn),
      createdBy: nftStake.createdBy || '',
      member: nftStake.member || '',
      space: nftStake.space || '',
      nft: nftStake.nft || '',
      collection: nftStake.collection || '',
      weeks: nftStake.weeks || 0,
      expiresAt: pgDateToTimestamp(nftStake.expiresAt)!,
      expirationProcessed: nftStake.expirationProcessed!,
      type: nftStake.type as StakeType,
    });
}
