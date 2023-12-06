import { Dataset, WEN_FUNC } from '@build-5/interfaces';
import axios from 'axios';
import FormData from 'form-data';
import { API_KEY, Build5 } from '.';
import { AuctionDataset } from './datasets/AuctionDataset';
import { BadgesDataset } from './datasets/BadgesDataset';
import { MemberDataset } from './datasets/MemberDataset';
import { NftDataset } from './datasets/NftDataset';
import { NftStakeDataset } from './datasets/NftStakeDataset';
import { NotificationDataset } from './datasets/NotificationDataset';
import { ProjectDataset } from './datasets/ProjectDataset';
import { StakeDataset } from './datasets/StakeDataset';
import { StakeRewardDataset } from './datasets/StakeRewardDataset';
import { StampDataset } from './datasets/StampDataset';
import { TickerDataset } from './datasets/TickerDataset';
import { TransactionDataset } from './datasets/TransactionDataset';
import { AwardDataset } from './datasets/award/AwardDataset';
import { CollectionDataset } from './datasets/collection/CollectionDataset';
import { DatasetType } from './datasets/common';
import { MilestoneDataset } from './datasets/milestone/MilestoneDataset';
import { ProposalDataset } from './datasets/proposal/ProposalDataset';
import { SpaceDataset } from './datasets/space/SpaceDataset';
import { AirdropDataset } from './datasets/token/AirdropDataset';
import { TokenDataset } from './datasets/token/TokenDataset';
import { TokenMarketDataset } from './datasets/token/TokenMarketDataset';
import { TokenPurchaseDataset } from './datasets/token/TokenPurchaseDataset';

export class HttpsWrapper {
  constructor(private readonly origin: Build5) {}

  dataset<D extends Dataset>(dataset: D): DatasetType<D> {
    switch (dataset) {
      case Dataset.AIRDROP:
        return new AirdropDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.AWARD:
        return new AwardDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.AUCTION:
        return new AuctionDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.BADGES:
        return new BadgesDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.COLLECTION:
        return new CollectionDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.MILESTONE:
        return new MilestoneDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.MILESTONE_RMS:
        return new MilestoneDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.MILESTONE_SMR:
        return new MilestoneDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.MEMBER:
        return new MemberDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.NFT:
        return new NftDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.NFT_STAKE:
        return new NftStakeDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.NOTIFICATION:
        return new NotificationDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.PROJECT:
        return new ProjectDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.PROPOSAL:
        return new ProposalDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.SPACE:
        return new SpaceDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.STAKE:
        return new StakeDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.STAKE_REWARD:
        return new StakeRewardDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.STAMP:
        return new StampDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.TOKEN:
        return new TokenDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.TOKEN_MARKET:
        return new TokenMarketDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.TOKEN_PURCHASE:
        return new TokenPurchaseDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.TICKER:
        return new TickerDataset(this.origin, dataset) as DatasetType<D>;
      case Dataset.TRANSACTION:
        return new TransactionDataset(this.origin, dataset) as DatasetType<D>;
      default:
        throw Error('invalid dataset name');
    }
  }

  uploadFile = async (pathToFile: string, member: string, uid: string) => {
    const isLocal = this.origin === Build5.LOCAL;
    const url = this.origin + `/${isLocal ? 'https-' : ''}` + WEN_FUNC.uploadFile;
    console.log(API_KEY[this.origin]);
    const form = new FormData();
    form.append('member', member);
    form.append('uid', uid);
    console.log(this.origin);
    form.append('projectApiKey', API_KEY[this.origin]);
    // Disabled
    console.log('FS Disabled to enable browser support', pathToFile);
    // form.append('file', fs.createReadStream(pathToFile));
    try {
      return (await axios.post(url, form)).data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw error.response.data;
    }
  };
}
