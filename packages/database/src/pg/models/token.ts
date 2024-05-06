/**
 * This file was automatically generated by knex
 * Do not modify this file manually
 */
import * as commons from './common';

export interface PgTokenVotes extends commons.BaseSubRecord {
  direction?: number;
}

export interface PgTokenStats extends commons.BaseSubRecord {
  votes_upvotes?: number;
  votes_downvotes?: number;
  votes_voteDiff?: number;
  ranks_count?: number;
  ranks_sum?: number;
  ranks_avg?: number;
  volumeTotal?: number;
  volume_in24h?: number;
  volume_in48h?: number;
  volume_in7d?: number;
  stakes_static_amount?: number;
  stakes_static_totalAmount?: number;
  stakes_static_value?: number;
  stakes_static_totalValue?: number;
  stakes_static_stakingMembersCount?: number;
  stakes_dynamic_amount?: number;
  stakes_dynamic_totalAmount?: number;
  stakes_dynamic_value?: number;
  stakes_dynamic_totalValue?: number;
  stakes_dynamic_stakingMembersCount?: number;
  stakeExpiry?: Record<string, unknown>;
}

export interface PgTokenRanks extends commons.BaseSubRecord {
  rank?: number;
}

export interface PgTokenPurchase extends commons.BaseRecord {
  token?: string;
  tokenStatus?: string;
  sell?: string;
  buy?: string;
  count?: number;
  price?: number;
  triggeredBy?: string;
  billPaymentId?: string;
  buyerBillPaymentId?: string;
  royaltyBillPayments?: string[];
  sourceNetwork?: string;
  targetNetwork?: string;
  sellerTokenTradingFeePercentage?: number;
  sellerTier?: number;
  in24h?: boolean;
  in48h?: boolean;
  in7d?: boolean;
}

export interface PgTokenMarket extends commons.BaseRecord {
  owner?: string;
  token?: string;
  tokenStatus?: string;
  type?: string;
  count?: number;
  price?: number;
  totalDeposit?: number;
  balance?: number;
  fulfilled?: number;
  status?: string;
  orderTransactionId?: string;
  paymentTransactionId?: string;
  creditTransactionId?: string;
  expiresAt?: Date;
  shouldRetry?: boolean;
  sourceNetwork?: string;
  targetNetwork?: string;
  targetAddress?: string;
}

export interface PgTokenDistribution extends commons.BaseSubRecord {
  totalDeposit?: number;
  totalPaid?: number;
  refundedAmount?: number;
  totalBought?: number;
  reconciled?: boolean;
  billPaymentId?: string;
  creditPaymentId?: string;
  royaltyBillPaymentId?: string;
  tokenClaimed?: number;
  lockedForSale?: number;
  sold?: number;
  totalPurchased?: number;
  tokenOwned?: number;
  mintedClaimedOn?: Date;
  mintingTransactions?: string[];
  stakeRewards?: number;
  extraStakeRewards?: number;
  totalUnclaimedAirdrop?: number;
  stakeVoteTransactionId?: string;
  stakes_static_amount?: number;
  stakes_static_totalAmount?: number;
  stakes_static_value?: number;
  stakes_static_totalValue?: number;
  stakes_static_stakingMembersCount?: number;
  stakes_dynamic_amount?: number;
  stakes_dynamic_totalAmount?: number;
  stakes_dynamic_value?: number;
  stakes_dynamic_totalValue?: number;
  stakes_dynamic_stakingMembersCount?: number;
  stakeExpiry?: Record<string, unknown>;
}

export interface PgToken extends commons.BaseRecord {
  name?: string;
  symbol?: string;
  title?: string;
  description?: string;
  shortDescriptionTitle?: string;
  shortDescription?: string;
  space?: string;
  pricePerToken?: number;
  totalSupply?: number;
  allocations?: Record<string, unknown>[];
  saleStartDate?: Date;
  saleLength?: number;
  coolDownEnd?: Date;
  autoProcessAt100Percent?: boolean;
  approved?: boolean;
  rejected?: boolean;
  public?: boolean;
  links?: string[];
  icon?: string;
  overviewGraphics?: string;
  status?: string;
  totalDeposit?: number;
  tokensOrdered?: number;
  totalAirdropped?: number;
  termsAndConditions?: string;
  access?: number;
  accessAwards?: string[];
  accessCollections?: string[];
  ipfsMedia?: string;
  ipfsMetadata?: string;
  ipfsRoot?: string;
  mintingData_mintedBy?: string;
  mintingData_mintedOn?: Date;
  mintingData_aliasBlockId?: string;
  mintingData_aliasId?: string;
  mintingData_aliasStorageDeposit?: number;
  mintingData_tokenId?: string;
  mintingData_blockId?: string;
  mintingData_foundryStorageDeposit?: number;
  mintingData_network?: string;
  mintingData_networkFormat?: string;
  mintingData_vaultAddress?: string;
  mintingData_tokensInVault?: number;
  mintingData_vaultStorageDeposit?: number;
  mintingData_guardianStorageDeposit?: number;
  mintingData_meltedTokens?: number;
  mintingData_circulatingSupply?: number;
  rankCount?: number;
  rankSum?: number;
  rankAvg?: number;
  mediaStatus?: string;
  mediaUploadErrorCount?: number;
  tradingDisabled?: boolean;
  decimals?: number;
  votes_upvotes?: number;
  votes_downvotes?: number;
  votes_voteDiff?: number;
}
