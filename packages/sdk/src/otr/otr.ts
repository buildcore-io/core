import { Dataset } from '@buildcore/interfaces';
import { AuctionOtrDataset } from './datasets/AuctionOtrDataset';
import { AwardOtrDataset } from './datasets/AwardOtrDataset';
import { MemberOtrDataset } from './datasets/MemberOtrDataset';
import { NftOtrDataset } from './datasets/NftOtrDataset';
import { ProposalOtrDataset } from './datasets/ProposalOtrDataset';
import { SpaceOtrDataset } from './datasets/SpaceOtrDataset';
import { StamptOtrDataset } from './datasets/StampOtrDataset';
import { SwapOtrDataset } from './datasets/SwapOtrDataset';
import { TokenOtrDataset } from './datasets/TokenOtrDataset';
import { DatasetType } from './datasets/common';

/**
 * OTR Dataset selection.
 *
 */
export class OtrWrapper {
  constructor(private readonly otrAddress: string) {}

  /**
   * Access Dataset.
   *
   * @param dataset {@link DatasetType}
   * @returns
   */
  dataset<D extends Dataset>(dataset: D): DatasetType<D> {
    switch (dataset) {
      case Dataset.AUCTION:
        return new AuctionOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.AWARD:
        return new AwardOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.MEMBER:
        return new MemberOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.NFT:
        return new NftOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.PROPOSAL:
        return new ProposalOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.SPACE:
        return new SpaceOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.TOKEN:
        return new TokenOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.STAMP:
        return new StamptOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.SWAP:
        return new SwapOtrDataset(this.otrAddress) as DatasetType<D>;
      default:
        throw Error('invalid dataset name');
    }
  }
}
