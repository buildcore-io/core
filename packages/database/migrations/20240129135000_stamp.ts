import { COL } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.STAMP, undefined, (table) => {
    baseRecord(knex, table);

    table.string('space');
    table.string('build5Url');
    table.text('originUri');
    table.string('checksum');
    table.string('extension');
    table.double('bytes');
    table.double('costPerMb');
    table.string('network');

    table.string('ipfsMedia');
    table.string('ipfsRoot');

    table.timestamp('expiresAt');
    table.string('order');
    table.boolean('funded');
    table.boolean('expired');

    table.string('mediaStatus');
    table.double('mediaUploadErrorCount');

    table.string('aliasId');
    table.string('nftId');
  });
}

export async function down(): Promise<void> {}
