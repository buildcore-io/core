import { Mnemonic, Network } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgMnemonic } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class MnemonicConverter implements Converter<Mnemonic, PgMnemonic> {
  toPg = (mnemonic: Mnemonic): PgMnemonic => ({
    uid: mnemonic.uid,
    project: mnemonic.project,
    createdOn: mnemonic.createdOn?.toDate(),
    updatedOn: mnemonic.updatedOn?.toDate(),
    createdBy: mnemonic.createdBy,

    mnemonic: mnemonic.mnemonic,
    network: mnemonic.network,
    lockedBy: mnemonic.lockedBy,
    consumedOutputIds: mnemonic.consumedOutputIds,
    consumedNftOutputIds: mnemonic.consumedNftOutputIds,
    consumedAliasOutputIds: mnemonic.consumedAliasOutputIds,
  });

  fromPg = (pg: PgMnemonic): Mnemonic =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      mnemonic: pg.mnemonic,
      network: pg.network as Network,
      lockedBy: pg.lockedBy,
      consumedOutputIds: pg.consumedOutputIds,
      consumedNftOutputIds: pg.consumedNftOutputIds,
      consumedAliasOutputIds: pg.consumedAliasOutputIds,
    });
}
