import { Dataset, Subset } from '@build-5/interfaces';
import { AuctionDataset } from './AuctionDataset';
import { BadgesDataset } from './BadgesDataset';
import { MemberDataset } from './MemberDataset';
import { MilestoneDataset } from './MilestoneDataset';
import { NftDataset } from './NftDataset';
import { NftStakeDataset } from './NftStakeDataset';
import { NotificationDataset } from './NotificationDataset';
import { ProjectDataset } from './ProjectDataset';
import { StakeDataset } from './StakeDataset';
import { StakeRewardDataset } from './StakeRewardDataset';
import { StampDataset } from './StampDataset';
import { TickerDataset } from './TickerDataset';
import { TransactionDataset } from './TransactionDataset';
import { AwardDataset } from './award/AwardDataset';
import { AwardOwnerSubset } from './award/AwardOwnerSubset';
import { AwardParticpateSubset } from './award/AwardParticipantSubset';
import { CollectionDataset } from './collection/CollectionDataset';
import { CollectionStatsSubset } from './collection/CollectionStatsSubset';
import { ProposalDataset } from './proposal/ProposalDataset';
import { ProposalMemberSubset } from './proposal/ProposalMemberSubset';
import { ProposalOwnerSubset } from './proposal/ProposalOwnerSubset';
import { SpaceBlockedMemberSubset } from './space/SpaceBlockedMemberSubset';
import { SpaceDataset } from './space/SpaceDataset';
import { SpaceGuardianSubset } from './space/SpaceGuardianSubset';
import { SpaceKnockingMemberSubset } from './space/SpaceKnockingMemberSubset';
import { SpaceMemberSubset } from './space/SpaceMemberSubset';
import { AirdropDataset } from './token/AirdropDataset';
import { TokenDataset } from './token/TokenDataset';
import { TokenDistributionSubset } from './token/TokenDistributionSubset';
import { TokenMarketDataset } from './token/TokenMarketDataset';
import { TokenPurchaseDataset } from './token/TokenPurchaseDataset';
import { TokenStatsSubset } from './token/TokenStatsSubset';

// prettier-ignore
export type DatasetType<T extends Dataset> = 
  T extends Dataset.AIRDROP ? AirdropDataset<Dataset.AIRDROP>:
  T extends Dataset.AWARD ? AwardDataset<Dataset.AWARD> :
  T extends Dataset.AUCTION ? AuctionDataset<Dataset.AUCTION> :
  T extends Dataset.BADGES ? BadgesDataset<Dataset.BADGES> :
  T extends Dataset.COLLECTION ? CollectionDataset<Dataset.COLLECTION> :
  T extends Dataset.MILESTONE ? MilestoneDataset<Dataset.MILESTONE> :
  T extends Dataset.MILESTONE_RMS ? MilestoneDataset<Dataset.MILESTONE_RMS> :
  T extends Dataset.MILESTONE_SMR ? MilestoneDataset<Dataset.MILESTONE_SMR> :
  T extends Dataset.MEMBER ? MemberDataset<Dataset.MEMBER> :
  T extends Dataset.NFT ? NftDataset<Dataset.NFT> :
  T extends Dataset.NFT_STAKE ? NftStakeDataset<Dataset.NFT_STAKE> :
  T extends Dataset.NOTIFICATION ? NotificationDataset<Dataset.NOTIFICATION> :
  T extends Dataset.PROJECT ? ProjectDataset<Dataset.PROJECT> :
  T extends Dataset.PROPOSAL ? ProposalDataset<Dataset.PROPOSAL> :
  T extends Dataset.SPACE ? SpaceDataset<Dataset.SPACE> :
  T extends Dataset.STAKE ? StakeDataset<Dataset.STAKE> :
  T extends Dataset.STAKE_REWARD ? StakeRewardDataset<Dataset.STAKE_REWARD> :
  T extends Dataset.STAMP ? StampDataset<Dataset.STAMP> :
  T extends Dataset.TOKEN ? TokenDataset<Dataset.TOKEN> :
  T extends Dataset.TOKEN_MARKET ? TokenMarketDataset<Dataset.TOKEN_MARKET> :
  T extends Dataset.TOKEN_PURCHASE ? TokenPurchaseDataset<Dataset.TOKEN_PURCHASE> :
  T extends Dataset.TICKER ? TickerDataset<Dataset.TICKER> :
  T extends Dataset.TRANSACTION ? TransactionDataset<Dataset.TRANSACTION> :
  unknown;

// prettier-ignore
export type SubsetType<D extends Dataset, S extends Subset> = 
  D extends Dataset.AWARD ? 
    S extends Subset.PARTICIPANTS ? AwardParticpateSubset : 
    S extends Subset.OWNERS ? AwardOwnerSubset : unknown :
  D extends Dataset.COLLECTION ? 
    S extends Subset.STATS ? CollectionStatsSubset : unknown :
  D extends Dataset.PROPOSAL ? 
    S extends Subset.MEMBERS ? ProposalMemberSubset :
    S extends Subset.OWNERS ? ProposalOwnerSubset : unknown :
  D extends Dataset.SPACE ?
    S extends Subset.MEMBERS ? SpaceMemberSubset :
    S extends Subset.GUARDIANS ? SpaceGuardianSubset :
    S extends Subset.KNOCKING_MEMBERS ? SpaceKnockingMemberSubset :
    S extends Subset.BLOCKED_MEMBERS ? SpaceBlockedMemberSubset : unknown :
  D extends Dataset.TOKEN ? 
    S extends Subset.DISTRIBUTION ? TokenDistributionSubset :
    S extends Subset.STATS ? TokenStatsSubset : unknown :
  unknown
