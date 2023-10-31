import { NetworkAddress, Restrictions, Timestamp } from '../base';
import { UnsoldMintingOptions } from '../collection';
import { NativeToken } from '../milestone';
import { StakeType } from '../stake';
import {
  CreditPaymentReason,
  Entity,
  StorageReturn,
  TransactionPayloadType,
  TransactionValidationType,
  WalletResult,
} from './common';

export interface TransactionPayload {
  type?: TransactionPayloadType;

  amount?: number;
  sourceAddress?: NetworkAddress;
  targetAddress?: NetworkAddress;
  sourceTransaction?: string | string[];
  validationType?: TransactionValidationType;
  expiresOn?: Timestamp | null;
  reconciled?: boolean;
  void?: boolean;

  // MINT_COLLECTION
  collection?: NetworkAddress | null;
  unsoldMintingOptions?: UnsoldMintingOptions;
  newPrice?: number;
  collectionStorageDeposit?: number;
  nftsStorageDeposit?: number;
  aliasStorageDeposit?: number;
  nftsToMint?: number;

  // TransactionPayloadType.CREDIT_LOCKED_FUNDS,
  transaction?: NetworkAddress;
  unlockedBy?: NetworkAddress;

  // TransactionPayloadType.NFT_BID,
  beneficiary?: Entity;
  beneficiaryUid?: NetworkAddress;
  beneficiaryAddress?: NetworkAddress;
  royaltiesFee?: number;
  royaltiesSpace?: NetworkAddress;
  royaltiesSpaceAddress?: NetworkAddress;
  chainReference?: string | null;
  nft?: NetworkAddress | null;
  restrictions?: Restrictions;

  // TransactionPayloadType.TOKEN_AIRDROP,
  token?: NetworkAddress;
  quantity?: number;

  tokenSymbol?: string;

  // TransactionPayloadType.TOKEN_PURCHASE
  unclaimedAirdrops?: number;
  totalAirdropCount?: number;

  // TransactionPayloadType.IMPORT_TOKEN,
  tokenId?: NetworkAddress;

  // TransactionPayloadType.MINT_TOKEN,
  foundryStorageDeposit?: number;
  vaultStorageDeposit?: number;
  guardianStorageDeposit?: number;
  tokensInVault?: number;

  // TransactionPayloadType.MINT_ALIAS ,
  orderId?: NetworkAddress;
  collectionOutputAmount?: number;

  aliasOutputAmount?: number;
  nftOutputAmount?: number;

  // TransactionPayloadType.MINT_COLLECTION - METADATA_NFT,
  aliasId?: NetworkAddress;
  aliasBlockId?: NetworkAddress;
  aliasGovAddress?: NetworkAddress;

  // TransactionPayloadType.UPDATE_MINTED_NFT
  // TransactionPayloadType.MINT_NFT,
  collectionId?: NetworkAddress | null;
  nftId?: NetworkAddress | null;

  // TransactionPayloadType.STAKE,
  nativeTokens?: NativeToken[];
  previousOwnerEntity?: Entity;
  previousOwner?: string;
  ownerEntity?: Entity;
  owner?: string;
  royalty?: boolean;
  vestingAt?: Timestamp | null;
  customMetadata?: { [key: string]: string };
  stake?: string;

  award?: NetworkAddress | null;
  legacyAwardFundRequestId?: NetworkAddress;

  weeks?: number;
  stakeType?: StakeType;

  // TransactionPayloadType.SELL_TOKEN
  // TransactionPayloadType.BUY_TOKEN,
  count?: number;
  price?: number;

  // TransactionPayloadType.BADGE
  tokenReward?: number;
  edition?: number;
  participatedOn?: Timestamp;

  //  TransactionPayloadType.PROPOSAL_VOTE
  proposalId?: NetworkAddress;
  voteValues?: number[];

  // TransactionPayloadType.MINTED_TOKEN_TRADE
  storageDepositSourceAddress?: NetworkAddress;
  storageReturn?: StorageReturn;

  airdropId?: NetworkAddress;

  walletReference?: WalletResult;

  nfts?: NetworkAddress[];

  tag?: string;

  metadata?: { [key: string]: unknown };
  response?: { [key: string]: unknown };

  reason?: CreditPaymentReason;

  invalidPayment?: boolean;
  outputToConsume?: string;
  dependsOnBillPayment?: boolean;
  milestoneTransactionPath?: string;
  values?: number[];
  tokenAmount?: number;
  weight?: number;
  weightMultiplier?: number;
  votes?: number[];
  creditId?: NetworkAddress;
  outputConsumed?: boolean;
  outputConsumedOn?: Timestamp;
  stakes?: NetworkAddress[];
  stakeReward?: NetworkAddress;

  tanglePuchase?: boolean;
  disableWithdraw?: boolean;

  lockCollectionNft?: boolean;

  stamp?: string;
  tokenTradeOderTargetAddress?: string;

  auction?: string;
}
