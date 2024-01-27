import { Dataset, FileUploadResponse, WEN_FUNC } from '@build-5/interfaces';
import axios from 'axios';
import FormData, { Stream } from 'form-data';
import { Observable as RxjsObservable, from, map } from 'rxjs';
import { Build5 } from '.';
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
import { Observable } from './tag.tracker';

/**
 * Project wrapper.
 */
export class ProjectWrapper {
  constructor(
    private readonly origin: Build5,
    private readonly apiKey: string,
  ) {}

  /**
   * Select dataset.
   * @param dataset
   * @returns
   */
  dataset<D extends Dataset>(dataset: D): DatasetType<D> {
    switch (dataset) {
      case Dataset.AIRDROP:
        return new AirdropDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.AWARD:
        return new AwardDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.AUCTION:
        return new AuctionDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.BADGES:
        return new BadgesDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.COLLECTION:
        return new CollectionDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.MILESTONE:
        return new MilestoneDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.MILESTONE_RMS:
        return new MilestoneDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.MILESTONE_SMR:
        return new MilestoneDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.MEMBER:
        return new MemberDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.NFT:
        return new NftDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.NFT_STAKE:
        return new NftStakeDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.NOTIFICATION:
        return new NotificationDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.PROJECT:
        return new ProjectDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.PROPOSAL:
        return new ProposalDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.SPACE:
        return new SpaceDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.STAKE:
        return new StakeDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.STAKE_REWARD:
        return new StakeRewardDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.STAMP:
        return new StampDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.TOKEN:
        return new TokenDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.TOKEN_MARKET:
        return new TokenMarketDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.TOKEN_PURCHASE:
        return new TokenPurchaseDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.TICKER:
        return new TickerDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      case Dataset.TRANSACTION:
        return new TransactionDataset(this.origin, this.apiKey, dataset) as DatasetType<D>;
      default:
        throw Error('invalid dataset name');
    }
  }

  /**
   * Track transaction by it's tag ID. This is used to track OTR transaction progress.
   *
   * @param tag
   * @returns
   */
  trackByTag = (tag: string) => new Observable(this.origin, tag);

  /**
   * HTTPS Function to upload files to Build.5
   *
   * @param file
   * @param member
   * @param uid
   * @returns
   */
  uploadFile = (
    file: Blob | Stream,
    member: string,
    uid: string,
  ): RxjsObservable<FileUploadResponse> => {
    const isLocal = !Object.values(Build5).includes(this.origin);
    const url = this.origin + `/${isLocal ? 'https-' : ''}` + WEN_FUNC.uploadFile;
    const form = new FormData();
    form.append('member', member);
    form.append('uid', uid);
    form.append('projectApiKey', this.apiKey);
    form.append('file', file);
    try {
      return from(axios.post(url, form)).pipe(map((r) => r.data as FileUploadResponse));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw error.response.data;
    }
  };
}
