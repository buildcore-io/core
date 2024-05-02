import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable, mintingData } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.NFT, undefined, (table) => {
    baseRecord(knex, table);
    table.string('name');
    table.text('description');
    table.string('collection');
    table.string('owner');
    table.boolean('isOwned');
    table.text('media');
    table.string('ipfsMedia');
    table.string('ipfsMetadata');
    table.string('ipfsRoot');
    table.integer('saleAccess');
    table.specificType('saleAccessMembers', 'TEXT[]').defaultTo('{}');
    table.integer('available');
    table.timestamp('availableFrom');
    table.timestamp('auctionFrom');
    table.timestamp('auctionTo');
    table.timestamp('extendedAuctionTo');
    table.double('auctionHighestBid');
    table.string('auctionHighestBidder');
    table.double('price');
    table.double('totalTrades');
    table.timestamp('lastTradedOn');
    table.double('availablePrice');
    table.double('auctionFloorPrice');
    table.double('auctionLength');
    table.double('extendedAuctionLength');
    table.double('extendAuctionWithin');

    table.integer('type');
    table.string('space');
    table.text('url');
    table.boolean('approved');
    table.boolean('rejected');
    table.jsonb('properties').defaultTo({});
    table.jsonb('stats').defaultTo({});
    table.boolean('placeholderNft');
    table.double('position');
    table.boolean('locked');
    table.string('lockedBy');
    table.boolean('sold');
    mintingData(table);
    mintingData(table, 'depositData_');
    table.string('status');
    table.boolean('hidden');
    table.string('mediaStatus');
    table.double('mediaUploadErrorCount');
    table.timestamp('soldOn');
    table.boolean('setAsAvatar');
    table.string('auction');
  });
}

export async function down(): Promise<void> {}
