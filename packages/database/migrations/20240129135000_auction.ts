import { COL } from '@buildcore/interfaces';
import { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.AUCTION, undefined, (table) => {
    baseRecord(knex, table);
    table.string('space');
    table.timestamp('auctionFrom');
    table.timestamp('auctionTo');
    table.double('auctionLength');
    table.timestamp('extendedAuctionTo');
    table.double('extendedAuctionLength');
    table.double('extendAuctionWithin');
    table.double('auctionFloorPrice');
    table.double('minimalBidIncrement');
    table.string('auctionHighestBidder');
    table.double('auctionHighestBid');
    table.double('maxBids');
    table.string('type');
    table.string('network');
    table.string('nftId');
    table.string('targetAddress');
    table.boolean('active');
    table.boolean('topUpBased');

    table.jsonb('bids').defaultTo([]);
  });
}

export async function down(_knex: Knex): Promise<void> {}
