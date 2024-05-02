import { COL, SUB_COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, baseSubCollection, createTable, mintingData } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.COLLECTION, SUB_COL.STATS, (table) => {
    baseSubCollection(knex, table);

    table.double('votes_upvotes');
    table.double('votes_downvotes');
    table.double('votes_voteDiff');

    table.double('ranks_count');
    table.double('ranks_sum');
    table.double('ranks_avg');
  });

  await createTable(knex, COL.COLLECTION, undefined, (table) => {
    baseRecord(knex, table);
    table.string('name');
    table.text('description');
    table.text('bannerUrl');
    table.double('royaltiesFee');
    table.string('royaltiesSpace');

    table.double('total');
    table.double('totalTrades');
    table.timestamp('lastTradedOn');
    table.double('sold');
    table.text('discord');
    table.text('url');
    table.text('twitter');
    table.boolean('approved');
    table.boolean('rejected');
    table.boolean('limitedEdition');
    table.string('ipfsMedia');
    table.string('ipfsMetadata');
    table.string('ipfsRoot');

    table.string('category');
    table.integer('type');
    table.integer('access');
    table.specificType('accessAwards', 'TEXT[]').defaultTo('{}');
    table.specificType('accessCollections', 'TEXT[]').defaultTo('{}');

    table.string('space');
    table.timestamp('availableFrom');
    table.double('price');
    table.double('availablePrice');
    table.boolean('onePerMemberOnly');
    table.string('placeholderNft');
    table.text('placeholderUrl');
    table.string('status');

    mintingData(table);

    table.double('rankCount');
    table.double('rankSum');
    table.double('rankAvg');
    table.string('mediaStatus');
    table.double('mediaUploadErrorCount');
    table.double('stakedNft');
    table.double('nftsOnSale');
    table.double('nftsOnAuction');
    table.double('availableNfts');
    table.double('floorPrice');

    table.double('votes_upvotes');
    table.double('votes_downvotes');
    table.double('votes_voteDiff');

    table.jsonb('discounts').defaultTo([]);
  });

  await createTable(knex, COL.COLLECTION, SUB_COL.RANKS, (t) => {
    baseSubCollection(knex, t);
    t.double('rank');
  });

  await createTable(knex, COL.COLLECTION, SUB_COL.VOTES, (t) => {
    baseSubCollection(knex, t);
    t.double('direction');
  });
}

export async function down(): Promise<void> {}
