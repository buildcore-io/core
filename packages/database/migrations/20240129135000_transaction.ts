import { COL } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.TRANSACTION, undefined, (table) => {
    baseRecord(knex, table);
    table.string('network');
    table.string('type');
    table.boolean('isOrderType');
    table.string('member');
    table.string('space');
    table.boolean('shouldRetry');
    table.boolean('ignoreWallet');
    table.specificType('linkedTransactions', 'TEXT[]').defaultTo('{}');
    table.string('ignoreWalletReason');

    table.string('payload_type');
    table.double('payload_amount');
    table.string('payload_sourceAddress');
    table.string('payload_targetAddress');
    table.jsonb('payload_targetAddresses').defaultTo([]);
    table.specificType('payload_sourceTransaction', 'TEXT[]').defaultTo('{}');
    table.integer('payload_validationType');
    table.timestamp('payload_expiresOn');
    table.boolean('payload_reconciled');
    table.boolean('payload_void');

    table.string('payload_collection');
    table.string('payload_unsoldMintingOptions');
    table.double('payload_newPrice');
    table.double('payload_collectionStorageDeposit');
    table.double('payload_nftsStorageDeposit');
    table.double('payload_aliasStorageDeposit');
    table.double('payload_nftsToMint');

    table.string('payload_transaction');
    table.string('payload_unlockedBy');

    table.string('payload_beneficiary');
    table.string('payload_beneficiaryUid');
    table.string('payload_beneficiaryAddress');

    table.double('payload_royaltiesFee');
    table.string('payload_royaltiesSpace');
    table.string('payload_royaltiesSpaceAddress');
    table.string('payload_chainReference');
    table.string('payload_nft');
    table.jsonb('payload_restrictions').defaultTo({});
    table.string('payload_token');
    table.double('payload_quantity');
    table.string('payload_tokenSymbol');

    table.double('payload_unclaimedAirdrops');
    table.double('payload_totalAirdropCount');
    table.string('payload_tokenId');

    table.double('payload_foundryStorageDeposit');
    table.double('payload_vaultStorageDeposit');
    table.double('payload_guardianStorageDeposit');
    table.double('payload_tokensInVault');
    table.string('payload_orderId');
    table.double('payload_collectionOutputAmount');
    table.double('payload_aliasOutputAmount');
    table.double('payload_nftOutputAmount');

    table.string('payload_aliasId');
    table.string('payload_aliasBlockId');
    table.string('payload_aliasGovAddress');
    table.string('payload_collectionId');
    table.string('payload_nftId');
    table.jsonb('payload_nativeTokens').defaultTo([]);

    table.string('payload_previousOwnerEntity');
    table.string('payload_previousOwner');
    table.string('payload_ownerEntity');
    table.string('payload_owner');

    table.boolean('payload_royalty');
    table.timestamp('payload_vestingAt');

    table.jsonb('payload_customMetadata').defaultTo({});
    table.string('payload_stake');
    table.string('payload_award');
    table.string('payload_legacyAwardFundRequestId');
    table.double('payload_legacyAwardsBeeingFunded');
    table.double('payload_weeks');
    table.string('payload_stakeType');

    table.double('payload_count');
    table.double('payload_price');
    table.double('payload_tokenReward');
    table.double('payload_edition');
    table.timestamp('payload_participatedOn');
    table.string('payload_proposalId');
    table.specificType('payload_voteValues', 'FLOAT[]');
    table.string('payload_storageDepositSourceAddress');
    table.jsonb('payload_storageReturn').defaultTo({});
    table.string('payload_airdropId');

    table.specificType('payload_nfts', 'TEXT[]').defaultTo('{}');
    table.string('payload_tag');
    table.jsonb('payload_metadata').defaultTo({});
    table.jsonb('payload_response').defaultTo({});

    table.string('payload_reason');
    table.boolean('payload_invalidPayment');
    table.string('payload_outputToConsume');
    table.boolean('payload_dependsOnBillPayment');
    table.text('payload_milestoneTransactionPath');
    table.double('payload_tokenAmount');
    table.double('payload_weight');
    table.double('payload_weightMultiplier');
    table.specificType('payload_votes', 'FLOAT[]');
    table.specificType('payload_values', 'FLOAT[]');
    table.string('payload_creditId');
    table.boolean('payload_outputConsumed');
    table.timestamp('payload_outputConsumedOn');
    table.specificType('payload_stakes', 'TEXT[]').defaultTo('{}');
    table.string('payload_stakeReward');
    table.boolean('payload_tanglePuchase');
    table.boolean('payload_disableWithdraw');
    table.boolean('payload_lockCollectionNft');

    table.string('payload_stamp');
    table.string('payload_tokenTradeOderTargetAddress');
    table.string('payload_auction');

    table.double('payload_days');
    table.double('payload_dailyCost');

    table.jsonb('payload_nftOrders').defaultTo([]);
    table.string('payload_swap');

    table.timestamp('payload_walletReference_createdOn');
    table.timestamp('payload_walletReference_processedOn');
    table.string('payload_walletReference_chainReference');
    table.specificType('payload_walletReference_chainReferences', 'TEXT[]').defaultTo('{}');
    table.text('payload_walletReference_error');
    table.boolean('payload_walletReference_confirmed');
    table.timestamp('payload_walletReference_confirmedOn');
    table.text('payload_walletReference_milestoneTransactionPath');
    table.double('payload_walletReference_count');
    table.boolean('payload_walletReference_inProgress');
    table.double('payload_walletReference_nodeIndex');

    table.string('payload_outputId');
  });
}

export async function down(): Promise<void> {}
