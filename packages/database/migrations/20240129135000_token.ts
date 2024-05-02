import { COL, SUB_COL, StakeType, TokenStatus } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, baseSubCollection, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.TOKEN, undefined, (t) => {
    baseRecord(knex, t);

    t.string('name').defaultTo('');
    t.string('symbol').defaultTo('');
    t.text('title');
    t.text('description');
    t.text('shortDescriptionTitle');
    t.text('shortDescription');
    t.string('space');
    t.double('pricePerToken');

    t.double('totalSupply');
    t.jsonb('allocations').defaultTo([]);

    t.timestamp('saleStartDate');
    t.double('saleLength');
    t.timestamp('coolDownEnd');
    t.boolean('autoProcessAt100Percent');
    t.boolean('approved').defaultTo(false);
    t.boolean('rejected').defaultTo(false);
    t.boolean('public');
    t.specificType('links', 'TEXT[]').defaultTo('{}');
    t.text('icon');
    t.text('overviewGraphics');
    t.string('status').defaultTo(TokenStatus.PRE_MINTED);

    t.double('totalDeposit');

    t.double('tokensOrdered');
    t.double('totalAirdropped');
    t.text('termsAndConditions').defaultTo('');
    t.integer('access');
    t.specificType('accessAwards', 'TEXT[]').defaultTo('{}');

    t.specificType('accessCollections', 'TEXT[]').defaultTo('{}');

    t.string('ipfsMedia');
    t.string('ipfsMetadata');
    t.string('ipfsRoot');

    t.string('mintingData_mintedBy');
    t.timestamp('mintingData_mintedOn');
    t.string('mintingData_aliasBlockId');
    t.string('mintingData_aliasId');
    t.double('mintingData_aliasStorageDeposit');
    t.string('mintingData_tokenId');
    t.string('mintingData_blockId');
    t.double('mintingData_foundryStorageDeposit');

    t.string('mintingData_network');
    t.string('mintingData_networkFormat');

    t.string('mintingData_vaultAddress');
    t.double('mintingData_tokensInVault');
    t.double('mintingData_vaultStorageDeposit');
    t.double('mintingData_guardianStorageDeposit');
    t.double('mintingData_meltedTokens');
    t.double('mintingData_circulatingSupply');

    t.double('rankCount');
    t.double('rankSum');
    t.double('rankAvg');
    t.string('mediaStatus');
    t.double('mediaUploadErrorCount');
    t.boolean('tradingDisabled');
    t.double('decimals').defaultTo(6);

    t.double('votes_upvotes');
    t.double('votes_downvotes');
    t.double('votes_voteDiff');
  });

  await createTable(knex, COL.AIRDROP, undefined, (t) => {
    baseRecord(knex, t);
    t.string('member');
    t.string('token');
    t.string('award');
    t.timestamp('vestingAt');
    t.double('count');
    t.string('status');
    t.string('orderId');
    t.string('billPaymentId');
    t.string('sourceAddress');
    t.string('stakeRewardId');
    t.string('stakeType');
    t.boolean('isBaseToken');
  });

  await createTable(knex, COL.TOKEN, SUB_COL.DISTRIBUTION, (t) => {
    baseSubCollection(knex, t);
    t.double('totalDeposit');
    t.double('totalPaid');
    t.double('refundedAmount');
    t.double('totalBought');
    t.boolean('reconciled');
    t.string('billPaymentId');
    t.string('creditPaymentId');
    t.string('royaltyBillPaymentId');
    t.double('tokenClaimed');
    t.double('lockedForSale');
    t.double('sold');
    t.double('totalPurchased');
    t.double('tokenOwned');
    t.timestamp('mintedClaimedOn');

    t.specificType('mintingTransactions', 'TEXT[]').defaultTo('{}');

    t.double('stakeRewards');
    t.double('extraStakeRewards');
    t.double('totalUnclaimedAirdrop');
    t.string('stakeVoteTransactionId');

    for (const type of Object.values(StakeType)) {
      t.double('stakes_' + type + '_amount');
      t.double('stakes_' + type + '_totalAmount');
      t.double('stakes_' + type + '_value');
      t.double('stakes_' + type + '_totalValue');
      t.double('stakes_' + type + '_stakingMembersCount');
    }

    t.jsonb('stakeExpiry').defaultTo({});
  });

  await createTable(knex, COL.TOKEN, SUB_COL.STATS, (t) => {
    baseSubCollection(knex, t);
    t.double('votes_upvotes');
    t.double('votes_downvotes');
    t.double('votes_voteDiff');

    t.double('ranks_count');
    t.double('ranks_sum');
    t.double('ranks_avg');

    t.double('volumeTotal');
    for (const age of ['in24h', 'in48h', 'in7d']) {
      t.double('volume_' + age);
    }

    for (const type of Object.values(StakeType)) {
      t.double('stakes_' + type + '_amount');
      t.double('stakes_' + type + '_totalAmount');
      t.double('stakes_' + type + '_value');
      t.double('stakes_' + type + '_totalValue');
      t.double('stakes_' + type + '_stakingMembersCount');
    }

    t.jsonb('stakeExpiry').defaultTo({});
  });

  await createTable(knex, COL.TOKEN, SUB_COL.RANKS, (t) => {
    baseSubCollection(knex, t);
    t.double('rank');
  });

  await createTable(knex, COL.TOKEN, SUB_COL.VOTES, (t) => {
    baseSubCollection(knex, t);
    t.double('direction');
  });
}

export async function down(): Promise<void> {}
