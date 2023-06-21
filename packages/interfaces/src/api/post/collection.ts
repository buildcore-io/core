import {
  Access,
  Categories,
  CollectionType,
  DiscountLine,
  EthAddress,
  Network,
  UnsoldMintingOptions,
} from '../../models';

export interface UpdateMintedCollectionRequest {
  uid?: string;
  discounts: DiscountLine[];
  onePerMemberOnly: boolean;
  access: Access;
  accessAwards: EthAddress[];
  accessCollections: EthAddress[];
  price: number;
  availableFrom: Date;
}

export interface UpdateCollectionRequest extends UpdateMintedCollectionRequest {
  name?: string | null;
  description?: string | null;
  placeholderUrl?: string;
  bannerUrl?: string;
  royaltiesFee: number;
  royaltiesSpace: EthAddress;
  discord?: string | null;
  url?: string | null;
  twitter?: string | null;
}

export interface CreateCollectionRequest extends UpdateCollectionRequest {
  type: CollectionType.CLASSIC | CollectionType.GENERATED | CollectionType.SFT;
  space: string;
  price: number;
  access: Access;
  availableFrom: Date;
  category: Categories;
  limitedEdition?: boolean;
}

export interface ApproveCollectionRequest {
  uid: EthAddress;
}

export interface RejectCollectionRequest {
  uid: EthAddress;
}

export interface CollectionMintRequest {
  collection: EthAddress;
  network: Network;
  unsoldMintingOptions: UnsoldMintingOptions;
  price?: number;
}
