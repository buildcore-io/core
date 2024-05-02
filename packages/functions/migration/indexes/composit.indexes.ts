import { Knex } from 'knex';

export const createCompositeIndexes = async (knex: Knex) => {
  await knex.raw(`
  CREATE INDEX IF NOT EXISTS 
  transaction_45109450510125404 
  ON transaction 
  (type, "payload_walletReference_confirmed", "payload_walletReference_count", "payload_sourceAddress", "payload_storageDepositSourceAddress", "payload_aliasGovAddress", uid);

  CREATE INDEX IF NOT EXISTS stake_8122990901144977 ON stake ("expiresAt", "expirationProcessed", uid);

  CREATE INDEX IF NOT EXISTS auction_016830811329459072 ON auction ("auctionTo", active, uid);

  CREATE INDEX IF NOT EXISTS token_distribution_24062260178740802 ON token_distribution ("parentId", "totalDeposit", uid);
 
  CREATE INDEX IF NOT EXISTS token_market_05202804154440055 ON token_market (type, token, price, status, "createdOn", uid);
 
  CREATE INDEX IF NOT EXISTS airdrop_10766328113159873 ON airdrop (token, member, status, "vestingAt", uid);

  CREATE INDEX IF NOT EXISTS nft_stake_9374899382500212 ON nft_stake ("expiresAt", "expirationProcessed", uid);

  CREATE INDEX IF NOT EXISTS token_market_5085783731118316 ON token_market (status, "expiresAt", uid);

  CREATE INDEX IF NOT EXISTS proposal_47206329091177945 ON proposal (completed, "settings_endDate", uid);

  CREATE INDEX IF NOT EXISTS transaction_05013994603077765 ON transaction (type, "payload_sourceTransaction", uid);

  CREATE INDEX IF NOT EXISTS award_3008696163765725 ON award (completed, "endDate", uid);

  CREATE INDEX IF NOT EXISTS token_market_28978449906188053 ON token_market ("sourceNetwork", token, price, status, "createdOn", uid);

  CREATE INDEX IF NOT EXISTS nft_8290768562587871 ON nft (sold, locked, "placeholderNft", collection, position, uid);

  CREATE INDEX IF NOT EXISTS airdrop_30090768626374964 ON airdrop (token, member, status, "createdOn", uid);

  CREATE INDEX IF NOT EXISTS token_market_9362306629620307 ON token_market (token, status, price, uid);

  CREATE INDEX IF NOT EXISTS transaction_5731235900684764 ON transaction ("payload_walletReference_confirmed", "payload_walletReference_inProgress", "payload_walletReference_count", uid);

  CREATE INDEX IF NOT EXISTS stake_reward_7659187763841746 ON stake_reward (status, "endDate", uid);

  CREATE INDEX IF NOT EXISTS stamp_5834694438249675 ON stamp ("expiresAt", expired, uid);

  CREATE INDEX IF NOT EXISTS transaction_41816187111373495 ON transaction (member, type, "createdOn", uid);

  CREATE INDEX IF NOT EXISTS nft_41816187111373496 ON nft (collection, "availablePrice", "saleAccess", available);

  CREATE INDEX IF NOT EXISTS transaction_41816187111373494 ON "transaction" ("type", "payload_void", "payload_reconciled", "payload_expiresOn", "uid");
  `);
};
