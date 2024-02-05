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

/**
 * Interface representing an NFT bulk order item
 */
export interface NftBulkOrder {
  /**
   * Id of the collection
   */
  collection: string;
  /**
   * Id of the NFT that was purchased. Do not set, it will be set by system.
   */
  nft: string;
  /**
   * Id of the nft that was requested to be purchased. If not set, system will choose a random nft
   */
  requestedNft?: string;
  /**
   * Price of the NFT. Do not set, it will be set by system.
   */
  price: number;
  /**
   * Error in case purchase could not be done. Do not set, it will be set by system.
   */
  error: number;
  /**
   * In case of minted NFT, it can be withdrawn automatically to this address.
   */
  targetAddress?: string;
}

/**
 * Interface used to specify a transaction to multiuple recipients.
 * Used only internally
 */
export interface SendToManyTargets {
  toAddress: string;
  amount: number;
  customMetadata?: Record<string, unknown>;
  nativeTokens?: NativeToken[];
}

/**
 * Interface representing transaction payload type
 */
export interface TransactionPayload {
  /**
   * Type of the payload
   */
  type?: TransactionPayloadType;
  /**
   * Amount used or transfered
   */
  amount?: number;
  /**
   * Source address of the transaction
   */
  sourceAddress?: NetworkAddress;
  /**
   * Target address of the transaction
   */
  targetAddress?: NetworkAddress;
  /**
   * Target addresses of the transaction incase of multy target transaction
   */
  targetAddresses?: SendToManyTargets[];
  /**
   * A reference to the source order or payment
   */
  sourceTransaction?: string | string[];
  /**
   * Specifies the processing type
   */
  validationType?: TransactionValidationType;
  /**
   * Order will expire on this date. Once order is expired, it can not receive any more requests.
   */
  expiresOn?: Timestamp | null;
  /**
   * Boolean value specifying if the order was reconciled or not
   */
  reconciled?: boolean;
  /**
   * Boolean value specifying if the order was voided
   */
  void?: boolean;

  // MINT_COLLECTION
  /**
   * Collection id
   */
  collection?: NetworkAddress | null;
  /**
   * Specifies what should happen with unsold NFTs upon minting.
   */
  unsoldMintingOptions?: UnsoldMintingOptions;
  /**
   * New price of unsold NFTs after minting
   */
  newPrice?: number;
  /**
   * Storage deposit needed to mint the collection
   */
  collectionStorageDeposit?: number;
  /**
   * Storage deposit needed to mint the NFTs
   */
  nftsStorageDeposit?: number;
  /**
   * Storage deposit needed to mint the alias
   */
  aliasStorageDeposit?: number;
  /**
   * NFTs to mint
   */
  nftsToMint?: number;

  // TransactionPayloadType.CREDIT_LOCKED_FUNDS,
  /**
   * Transaction id
   */
  transaction?: NetworkAddress;
  /**
   * Member id who unlocked the transaction
   */
  unlockedBy?: NetworkAddress;

  // TransactionPayloadType.NFT_BID,
  /**
   * Beneficiary type of the transaction
   */
  beneficiary?: Entity;
  /**
   * Beneficiary id of the transaction
   */
  beneficiaryUid?: NetworkAddress;
  /**
   * Beneficiary address of the transaction
   */
  beneficiaryAddress?: NetworkAddress;
  /**
   * Royalty fee
   */
  royaltiesFee?: number;
  /**
   * Royalty space
   */
  royaltiesSpace?: NetworkAddress;
  /**
   * Royalty space address
   */
  royaltiesSpaceAddress?: NetworkAddress;
  /**
   * Tangle chain reference
   */
  chainReference?: string | null;
  /**
   * NFT id
   */
  nft?: NetworkAddress | null;
  /**
   * Restrictions applied when purchasing the NFT
   */
  restrictions?: Restrictions;

  // TransactionPayloadType.TOKEN_AIRDROP,
  /**
   * Token id
   */
  token?: NetworkAddress;
  /**
   * Quantity of tokens purchased
   */
  quantity?: number;

  tokenSymbol?: string;

  // TransactionPayloadType.TOKEN_PURCHASE
  /**
   * Unclaimed airdrops count
   */
  unclaimedAirdrops?: number;
  /**
   * Total airdrops count
   */
  totalAirdropCount?: number;

  // TransactionPayloadType.IMPORT_TOKEN,
  /**
   * Tangle id of a token
   */
  tokenId?: NetworkAddress;

  // TransactionPayloadType.MINT_TOKEN
  /**
   * Storage deposit needed to mint the foundry
   */
  foundryStorageDeposit?: number;
  /**
   * Storage deposit used by the vault
   */
  vaultStorageDeposit?: number;
  /**
   * Storage deposit needed for the guardian
   */
  guardianStorageDeposit?: number;
  /**
   * Tokens stored in the space's vault
   */
  tokensInVault?: number;

  // TransactionPayloadType.MINT_ALIAS
  /**
   * Order transaction id
   */
  orderId?: NetworkAddress;
  /**
   * Base token amount used by the collection output
   */
  collectionOutputAmount?: number;
  /**
   * Base token amount used by the alias output
   */
  aliasOutputAmount?: number;
  /**
   * Base token amount used by the nft output
   */
  nftOutputAmount?: number;

  // TransactionPayloadType.MINT_COLLECTION - METADATA_NFT,
  /**
   * Tanagle id of the alias
   */
  aliasId?: NetworkAddress;
  /**
   * Block id in which the alias was minted
   */
  aliasBlockId?: NetworkAddress;
  /**
   * Governor address of the alias
   */
  aliasGovAddress?: NetworkAddress;

  // TransactionPayloadType.UPDATE_MINTED_NFT
  // TransactionPayloadType.MINT_NFT
  /**
   * Tangle id of the collection
   */
  collectionId?: NetworkAddress | null;
  /**
   * Tangle id of the nft
   */
  nftId?: NetworkAddress | null;

  // TransactionPayloadType.STAKE,
  /**
   * Native tokens to transfer
   */
  nativeTokens?: NativeToken[];
  /**
   * Previous owner type
   */
  previousOwnerEntity?: Entity;
  /**
   * Previous owner
   */
  previousOwner?: string;
  /**
   * Current owner type
   */
  ownerEntity?: Entity;
  /**
   * Current owner
   */
  owner?: string;
  /**
   * If true, the payment is a royalty payment
   */
  royalty?: boolean;
  /**
   * Vesting time of the airdrop
   */
  vestingAt?: Timestamp | null;
  /**
   * Custom metadata that will be is on the output metadata
   */
  customMetadata?: { [key: string]: string };
  /**
   * Build5 stake id
   */
  stake?: string;
  /**
   * Build5 award id
   */
  award?: NetworkAddress | null;
  /**
   * Legacy award fund request id
   */
  legacyAwardFundRequestId?: NetworkAddress;
  /**
   * Length of the stake in weeks
   */
  weeks?: number;
  /**
   * Stake type
   */
  stakeType?: StakeType;

  // TransactionPayloadType.SELL_TOKEN
  // TransactionPayloadType.BUY_TOKEN
  /**
   * Token count set during token trading
   */
  count?: number;
  /**
   * Token price set during token trading
   */
  price?: number;

  // TransactionPayloadType.BADGE
  /**
   * Build5 id of the token reward
   */
  tokenReward?: number;
  /**
   * Edition of the badge
   */
  edition?: number;
  /**
   * Participation time
   */
  participatedOn?: Timestamp;

  // TransactionPayloadType.PROPOSAL_VOTE
  /**
   * Build5 id of the proposal
   */
  proposalId?: NetworkAddress;
  /**
   * Vote values
   */
  voteValues?: number[];

  // TransactionPayloadType.MINTED_TOKEN_TRADE
  /**
   * Address of the source storage deposit
   */
  storageDepositSourceAddress?: NetworkAddress;
  /**
   * Storage deposit return params
   */
  storageReturn?: StorageReturn;
  /**
   * Build5 id of the airdrop
   */
  airdropId?: NetworkAddress;
  /**
   * Result after processing the transaction
   */
  walletReference?: WalletResult;

  /**
   * Build5 of the minted NFTs
   */
  nfts?: NetworkAddress[];

  /**
   * Tag used on the transaction
   */
  tag?: string;

  /**
   * Metadata that will be set on the output
   */
  metadata?: { [key: string]: unknown };
  /**
   * Transaction response in case of processing failure
   */
  response?: { [key: string]: unknown };

  /**
   * Reason for crediting a payment
   */
  reason?: CreditPaymentReason;

  /**
   * If true, payment was considered as invalid
   */
  invalidPayment?: boolean;
  /**
   * Tangle if of the output that will be consumed
   */
  outputToConsume?: string;
  /**
   * True if credit needs to wait for a bill payment to be processed first
   */
  dependsOnBillPayment?: boolean;
  /**
   * Build5 path to the transaction
   */
  milestoneTransactionPath?: string;
  /**
   * Vote values
   */
  values?: number[];
  /**
   * Amount of the token
   */
  tokenAmount?: number;
  /**
   * Weight of the vote
   */
  weight?: number;
  /**
   * Multiplier for the vote weight
   */
  weightMultiplier?: number;
  /**
   * Votes
   */
  votes?: number[];
  /**
   * Build5 transaction id of a vote
   */
  creditId?: NetworkAddress;
  /**
   * True if output was consumed
   */
  outputConsumed?: boolean;
  /**
   * Output consumption time
   */
  outputConsumedOn?: Timestamp;
  /**
   * Build5 ids of the stakes
   */
  stakes?: NetworkAddress[];
  /**
   * Build5 ids of the stake rewards
   */
  stakeReward?: NetworkAddress;

  /**
   * True if the transaction is an OTR
   */
  tanglePuchase?: boolean;
  /**
   * If true, NFT won't be withdrawn after purchase
   */
  disableWithdraw?: boolean;

  /**
   * If true, collection NFT witll be locked
   */
  lockCollectionNft?: boolean;

  /**
   * Build5 if of the stamp
   */
  stamp?: string;
  /**
   * Target address of the token trade order
   */
  tokenTradeOderTargetAddress?: string;

  /**
   * Build5 id of the auction
   */
  auction?: string;

  /**
   * Days for which the stamp is stored
   */
  days?: number;
  /**
   * Daily cost of the stamp
   */
  dailyCost?: number;

  /**
   * List representing the NFT bulk order
   */
  nftOrders?: NftBulkOrder[];

  swap?: string;
}
