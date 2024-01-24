/**
 * Manually prepare TS file for docusaurus to export documentation.
 *
 * I'm not sure how better to do it atm.
 */
// HTTPS functions.
export * from './src/https/https';

// Datasets
export * from './src/https/datasets/AuctionDataset';
export * from './src/https/datasets/BadgesDataset';
export * from './src/https/datasets/Dataset';
export * from './src/https/datasets/MemberDataset';
export * from './src/https/datasets/NftDataset';
export * from './src/https/datasets/NotificationDataset';
export * from './src/https/datasets/ProjectDataset';
export * from './src/https/datasets/StakeDataset';
export * from './src/https/datasets/StakeRewardDataset';
export * from './src/https/datasets/StampDataset';
export * from './src/https/datasets/Subset';
export * from './src/https/datasets/TickerDataset';
export * from './src/https/datasets/TransactionDataset';
export * from './src/https/datasets/collection/CollectionDataset';
export * from './src/https/datasets/common';
export * from './src/https/datasets/milestone/MilestoneDataset';
export * from './src/https/datasets/proposal/ProposalDataset';
export * from './src/https/datasets/space/SpaceDataset';
export * from './src/https/datasets/token/TokenDataset';

// Subsets
export * from './src/https/datasets/award/AwardDataset';
export * from './src/https/datasets/award/AwardOwnerSubset';
export * from './src/https/datasets/award/AwardParticipantSubset';
export * from './src/https/datasets/collection/CollectionStatsSubset';
export * from './src/https/datasets/milestone/MilestoneTransactionSubset';
export * from './src/https/datasets/proposal/ProposalMemberSubset';
export * from './src/https/datasets/proposal/ProposalOwnerSubset';
export * from './src/https/datasets/space/SpaceBlockedMemberSubset';
export * from './src/https/datasets/space/SpaceGuardianSubset';
export * from './src/https/datasets/space/SpaceKnockingMemberSubset';
export * from './src/https/datasets/space/SpaceMemberSubset';
export * from './src/https/datasets/token/AirdropDataset';
export * from './src/https/datasets/token/TokenDistributionSubset';
export * from './src/https/datasets/token/TokenMarketDataset';
export * from './src/https/datasets/token/TokenPurchaseDataset';
export * from './src/https/datasets/token/TokenStatsSubset';

// Support functions
export * from './src/https/fetch.utils';
export * from './src/https/tag.tracker';

// OTR Functions
export * from './src/otr/otr';

// Datasets
export * from './src/otr/datasets/AuctionOtrDataset';
export * from './src/otr/datasets/AwardOtrDataset';
export * from './src/otr/datasets/MemberOtrDataset';
export * from './src/otr/datasets/NftOtrDataset';
export * from './src/otr/datasets/ProposalOtrDataset';
export * from './src/otr/datasets/SpaceOtrDataset';
export * from './src/otr/datasets/StampOtrDataset';
export * from './src/otr/datasets/TokenOtrDataset';
export * as DatasetClassOtr from './src/otr/datasets/common';
