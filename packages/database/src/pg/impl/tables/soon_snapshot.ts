import { SoonSnap } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgSoonSnapshot } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class SoonSnapshotConverter implements Converter<SoonSnap, PgSoonSnapshot> {
  toPg = (snapshot: SoonSnap): PgSoonSnapshot => ({
    uid: snapshot.uid,
    project: snapshot.project,
    createdOn: snapshot.createdOn?.toDate(),
    updatedOn: snapshot.updatedOn?.toDate(),
    createdBy: snapshot.createdBy,

    count: snapshot.count,
    paidOut: snapshot.paidOut,
    lastPaidOutOn: snapshot.lastPaidOutOn?.toDate(),
    ethAddress: snapshot.ethAddress,
    ethAddressVerified: snapshot.ethAddressVerified,
  });

  fromPg = (pg: PgSoonSnapshot): SoonSnap =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      count: pg.count || 0,
      paidOut: pg.paidOut || 0,
      lastPaidOutOn: pgDateToTimestamp(pg.lastPaidOutOn),
      ethAddress: pg.ethAddress || '',
      ethAddressVerified: pg.ethAddressVerified || false,
    });
}
