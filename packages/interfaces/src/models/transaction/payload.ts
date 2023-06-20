import { EthAddress, IotaAddress, Restrictions, Timestamp } from '../base';
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
  sourceAddress?: IotaAddress;
  targetAddress?: IotaAddress;
  sourceTransaction?: string | string[];
  validationType?: TransactionValidationType;
  expiresOn?: Timestamp | null;
  reconciled?: boolean;
  void?: boolean;

  // MINT_COLLECTION
  collection?: EthAddress | null;
  unsoldMintingOptions?: UnsoldMintingOptions;
  newPrice?: number;
  collectionStorageDeposit?: number;
  nftsStorageDeposit?: number;
  aliasStorageDeposit?: number;
  nftsToMint?: number;

  // TransactionPayloadType.CREDIT_LOCKED_FUNDS,
  transaction?: EthAddress;
  unlockedBy?: EthAddress;

  // TransactionPayloadType.NFT_BID,
  beneficiary?: Entity;
  beneficiaryUid?: EthAddress;
  beneficiaryAddress?: IotaAddress;
  royaltiesFee?: number;
  royaltiesSpace?: EthAddress;
  royaltiesSpaceAddress?: IotaAddress;
  chainReference?: string | null;
  nft?: EthAddress | null;
  restrictions?: Restrictions;

  // TransactionPayloadType.TOKEN_AIRDROP,
  token?: EthAddress;
  quantity?: number;

  tokenSymbol?: string;

  // TransactionPayloadType.TOKEN_PURCHASE
  unclaimedAirdrops?: number;
  totalAirdropCount?: number;

  // TransactionPayloadType.IMPORT_TOKEN,
  tokenId?: EthAddress;

  // TransactionPayloadType.MINT_TOKEN,
  foundryStorageDeposit?: number;
  vaultStorageDeposit?: number;
  guardianStorageDeposit?: number;
  tokensInVault?: number;

  // TransactionPayloadType.MINT_ALIAS ,
  orderId?: EthAddress;
  collectionOutputAmount?: number;

  // TransactionPayloadType.MINT_COLLECTION - METADATA_NFT,
  aliasId?: EthAddress;
  aliasBlockId?: EthAddress;
  aliasGovAddress?: IotaAddress;

  // TransactionPayloadType.UPDATE_MINTED_NFT
  // TransactionPayloadType.MINT_NFT,
  collectionId?: EthAddress | null;
  nftId?: EthAddress | null;

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

  award?: EthAddress | null;
  legacyAwardFundRequestId?: EthAddress;

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
  proposalId?: EthAddress;
  voteValues?: number[];

  // TransactionPayloadType.MINTED_TOKEN_TRADE
  storageDepositSourceAddress?: IotaAddress;
  storageReturn?: StorageReturn;

  airdropId?: EthAddress;

  walletReference?: WalletResult;

  nfts?: EthAddress[];

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
  creditId?: EthAddress;
  outputConsumed?: boolean;
  stakes?: EthAddress[];
  stakeReward?: EthAddress;
}
