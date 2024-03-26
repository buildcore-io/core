import {
  Auction,
  Award,
  AwardOwner,
  AwardParticipant,
  COL,
  Collection,
  CollectionStats,
  Member,
  Mnemonic,
  Nft,
  NftStake,
  Notification,
  Project,
  ProjectAdmin,
  ProjectApiKey,
  Proposal,
  ProposalMember,
  Rank,
  SUB_COL,
  SoonSnap,
  Space,
  SpaceGuardian,
  SpaceMember,
  Stake,
  StakeReward,
  Stamp,
  Swap,
  SystemConfig,
  Ticker,
  Timestamp,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenPurchase,
  TokenStats,
  TokenTradeOrder,
  Transaction,
  Vote,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { Knex } from 'knex';
import { IBatch } from '../interfaces/batch';
import { ICollection, ISubCollection } from '../interfaces/collection';
import { ArrayRemove, ArrayUnion, Converter, Increment } from '../interfaces/common';
import { IDatabase } from '../interfaces/database';
import { IDocument } from '../interfaces/document/document';
import { ISubDocument } from '../interfaces/document/sub.document';
import { ITransaction } from '../interfaces/transaction';
import {
  PgAirdrop,
  PgAuction,
  PgAward,
  PgAwardOwners,
  PgAwardParticipants,
  PgCollection,
  PgCollectionRanks,
  PgCollectionStats,
  PgCollectionVotes,
  PgMember,
  PgMilestone,
  PgMilestoneTransactions,
  PgMilestoneTransactionsUpdate,
  PgMilestoneUpdate,
  PgMnemonic,
  PgNft,
  PgNftStake,
  PgNotification,
  PgProject,
  PgProjectAdmins,
  PgProjectApiKey,
  PgProposal,
  PgProposalMembers,
  PgProposalOwners,
  PgSoonSnapshot,
  PgSoonSnapshotUpdate,
  PgSpace,
  PgSpaceGuardians,
  PgSpaceMembers,
  PgStake,
  PgStakeReward,
  PgStamp,
  PgSwap,
  PgSystem,
  PgTicker,
  PgToken,
  PgTokenDistribution,
  PgTokenMarket,
  PgTokenPurchase,
  PgTokenRanks,
  PgTokenStats,
  PgTokenVotes,
  PgTransaction,
} from '../models';
import { PgAirdropUpdate } from '../models/airdrop_update';
import { PgAuctionUpdate } from '../models/auction_update';
import {
  PgAwardOwnersUpdate,
  PgAwardParticipantsUpdate,
  PgAwardUpdate,
} from '../models/award_update';
import {
  PgCollectionRanksUpdate,
  PgCollectionStatsUpdate,
  PgCollectionUpdate,
  PgCollectionVotesUpdate,
} from '../models/collection_update';
import { BaseRecord } from '../models/common';
import { Update } from '../models/common_update';
import { PgMemberUpdate } from '../models/member_update';
import { PgMnemonicUpdate } from '../models/mnemonic_update';
import { PgNftStakeUpdate, PgNftUpdate } from '../models/nft_update';
import { PgNotificationUpdate } from '../models/notification_update';
import {
  PgProjectAdminsUpdate,
  PgProjectApiKeyUpdate,
  PgProjectUpdate,
} from '../models/project_update';
import {
  PgProposalMembersUpdate,
  PgProposalOwnersUpdate,
  PgProposalUpdate,
} from '../models/proposal_update';
import {
  PgSpaceGuardiansUpdate,
  PgSpaceMembersUpdate,
  PgSpaceUpdate,
} from '../models/space_update';
import { PgStakeRewardUpdate, PgStakeUpdate } from '../models/stake_update';
import { PgStampUpdate } from '../models/stamp_update';
import { PgSwapUpdate } from '../models/swap_update';
import { PgSystemUpdate } from '../models/system_update';
import { PgTickerUpdate } from '../models/ticker_update';
import {
  PgTokenDistributionUpdate,
  PgTokenMarketUpdate,
  PgTokenPurchaseUpdate,
  PgTokenRanksUpdate,
  PgTokenStatsUpdate,
  PgTokenUpdate,
  PgTokenVotesUpdate,
} from '../models/token_update';
import { PgTransactionUpdate } from '../models/transaction_update';
import { getKnex, getKnexTran, knex, knextran } from './knex';
import { subscriptions } from './pubsub';
import { AirdropConverter, PgAirdropCollection } from './tables/airdrop';
import { AuctionConverter } from './tables/auction';
import { AwardConverter } from './tables/award';
import { AwardOwnerConverter } from './tables/award_owner';
import { AwardParticipantConverter } from './tables/award_participant';
import { CollectionConverter, PgCollectionCollection } from './tables/collection';
import { CollectionRankConverter } from './tables/collection_rank';
import { CollectionStatsConverter } from './tables/collection_stats';
import { CollectionVotesConverter } from './tables/collection_vote';
import { MemberConverter } from './tables/member';
import { MilestoneConverter } from './tables/milestone';
import {
  MilestoneTransactionConverter,
  MilestoneTransactions,
} from './tables/milestone_transactions';
import { MnemonicConverter } from './tables/mnemonic';
import { NftConverter } from './tables/nft';
import { NftStakeConverter } from './tables/nft_stake';
import { NotificationConverter } from './tables/notification';
import { ProjectConverter } from './tables/project';
import { ProjectAdminConverter } from './tables/project_admin';
import { ProjectApiKeyConverter } from './tables/project_api_key';
import { ProposalConverter } from './tables/proposal';
import { ProposalMemberConverter } from './tables/proposal_member';
import { ProposalOwnerConverter } from './tables/proposal_owner';
import { SoonSnapshotConverter } from './tables/soon_snapshot';
import { SpaceConverter } from './tables/space';
import { SpaceMemberConverter } from './tables/space_member';
import { PgStakeCollection, StakeConverter } from './tables/stake';
import { StakeRewardConverter } from './tables/stake_reward';
import { StampConverter } from './tables/stamp';
import { SwapConverter } from './tables/swap';
import { SystemConverter } from './tables/system';
import { TickerConverter } from './tables/ticker';
import { TokenConverter } from './tables/token';
import {
  PgTokenDistributionCollection,
  TokenDistributionConverter,
} from './tables/token_distribution';
import { TokenTradeOrderConverter } from './tables/token_market';
import { TokenPurchaseConverter } from './tables/token_purchase';
import { TokenRankConverter } from './tables/token_rank';
import { TokenStatsConverter } from './tables/token_stats';
import { TokenVotesConverter } from './tables/token_vote';
import { TransactionConverter } from './tables/transaction';

// prettier-ignore
export type IColType<T extends COL, S extends SUB_COL | undefined = undefined> = 
  S extends undefined ?
    T extends COL.MEMBER ? ICollection<Member, PgMember, PgMemberUpdate> :
    T extends COL.SPACE ? ICollection<Space, PgSpace, PgSpaceUpdate> :
    T extends COL.PROJECT ? ICollection<Project, PgProject, PgProjectUpdate> :
    T extends COL.COLLECTION ? PgCollectionCollection :
    T extends COL.NFT ? ICollection<Nft, PgNft, PgNftUpdate> :
    T extends COL.NFT_STAKE ? ICollection<NftStake, PgNftStake, PgNftStakeUpdate> :
    T extends COL.TRANSACTION ? ICollection<Transaction, PgTransaction, PgTransactionUpdate> :
    T extends COL.AUCTION ? ICollection<Auction, PgAuction, PgAuctionUpdate> :
    T extends COL.AWARD ? ICollection<Award, PgAward, PgAwardUpdate> :
    T extends COL.TOKEN ? ICollection<Token, PgToken, PgTokenUpdate> :
    T extends COL.PROPOSAL ? ICollection<Proposal, PgProposal, PgProposalUpdate> :
    T extends COL.STAKE_REWARD ? ICollection<StakeReward, PgStakeReward, PgStakeRewardUpdate> :
    T extends COL.STAMP ? ICollection<Stamp, PgStamp, PgStampUpdate> :
    T extends COL.SWAP ? ICollection<Swap, PgSwap, PgSwapUpdate> :
    T extends COL.AIRDROP ? PgAirdropCollection :
    T extends COL.TOKEN_MARKET ? ICollection<TokenTradeOrder, PgTokenMarket, PgTokenMarketUpdate> :
    T extends COL.STAKE ? PgStakeCollection :
    T extends COL.TOKEN_PURCHASE ? ICollection<TokenPurchase, PgTokenPurchase, PgTokenPurchase> :
    T extends COL.MNEMONIC ? ICollection<Mnemonic, PgMnemonic, PgMnemonicUpdate> :
    T extends COL.NOTIFICATION ? ICollection<Notification, PgNotification, PgNotificationUpdate> :
    T extends COL.SYSTEM ? ICollection<SystemConfig, PgSystem, PgSystemUpdate> :
    T extends COL.TICKER ? ICollection<Ticker, PgTicker, PgTickerUpdate> :
    T extends COL.SOON_SNAP ? ICollection<SoonSnap, PgSoonSnapshot, PgSoonSnapshotUpdate> :
    T extends COL.MILESTONE ? ICollection<PgMilestone, PgMilestone, PgMilestoneUpdate> :
    T extends COL.MILESTONE_RMS ? ICollection<PgMilestone, PgMilestone, PgMilestoneUpdate> :
    T extends COL.MILESTONE_SMR ? ICollection<PgMilestone, PgMilestone, PgMilestoneUpdate> :
    undefined :
  S extends SUB_COL.OWNERS ? 
    T extends COL.AWARD ? ICollection<AwardOwner, PgAwardOwners, PgAwardOwnersUpdate> :
    T extends COL.PROPOSAL ? ICollection<ProposalMember, PgProposalOwners, PgProposalOwnersUpdate> :
  undefined:
  S extends SUB_COL.PARTICIPANTS ? 
    T extends COL.AWARD ? ICollection<AwardParticipant, PgAwardParticipants, PgAwardParticipantsUpdate> :
    undefined :
  S extends SUB_COL.MEMBERS ? 
    T extends COL.SPACE ? ICollection<SpaceMember, PgSpaceMembers, PgSpaceMembersUpdate> :
    T extends COL.PROPOSAL ? ICollection<ProposalMember, PgProposalMembers, PgProposalMembersUpdate> :
    undefined :
  S extends SUB_COL.BLOCKED_MEMBERS ? 
    T extends COL.SPACE ? ICollection<SpaceMember, PgSpaceMembers, PgSpaceMembersUpdate> :
    undefined :
  S extends SUB_COL.KNOCKING_MEMBERS ? 
    T extends COL.SPACE ? ICollection<SpaceMember, PgSpaceMembers, PgSpaceMembersUpdate> :
    undefined :
  S extends SUB_COL.GUARDIANS ? 
    T extends COL.SPACE ? ICollection<SpaceGuardian, PgSpaceGuardians, PgSpaceGuardiansUpdate> :
    undefined :
  S extends SUB_COL.DISTRIBUTION ?
    T extends COL.TOKEN ? PgTokenDistributionCollection :
    undefined :
  S extends SUB_COL.STATS ?
    T extends COL.COLLECTION ? ICollection<CollectionStats,  PgCollectionStats, PgCollectionStatsUpdate> :
    T extends COL.TOKEN ? ICollection<TokenStats,  PgTokenStats, PgTokenStatsUpdate> :
    undefined :
  S extends SUB_COL.RANKS ?
    T extends COL.TOKEN ? ICollection<Rank,  PgTokenRanks, PgTokenRanksUpdate> :
    T extends COL.COLLECTION ? ICollection<Rank, PgTokenRanks, PgCollectionRanks> :
    undefined :
  S extends SUB_COL.VOTES ?
    T extends COL.TOKEN ? ICollection<Vote, PgTokenVotes, PgTokenVotesUpdate> :
    T extends COL.COLLECTION ? ICollection<Vote, PgTokenVotes, PgCollectionVotes> :
    undefined :
  S extends SUB_COL.ADMINS ?
    T extends COL.PROJECT ? ICollection<ProjectAdmin, PgProjectAdmins, PgProjectAdminsUpdate> :
    undefined :
  S extends SUB_COL._API_KEY ?
    T extends COL.PROJECT ? ICollection<ProjectApiKey, PgProjectApiKey, PgProjectApiKeyUpdate> :
    undefined :
  S extends SUB_COL.TRANSACTIONS ? ISubCollection<MilestoneTransactions, PgMilestoneTransactions, PgMilestoneTransactionsUpdate> :
  undefined;

// prettier-ignore
export type IDocType<T extends COL, S extends SUB_COL | undefined = undefined> =
  S extends undefined ?
    T extends COL.MEMBER ? IDocument<Member, PgMember, PgMemberUpdate> :
    T extends COL.SPACE ? IDocument<Space, PgSpace, PgSpaceUpdate> :
    T extends COL.PROJECT ? IDocument<Project, PgProject, PgProjectUpdate> :
    T extends COL.COLLECTION ? IDocument<Collection, PgCollection, PgCollectionUpdate> :
    T extends COL.NFT ? IDocument<Nft, PgNft, PgNftUpdate> :
    T extends COL.NFT_STAKE ? IDocument<NftStake, PgNftStake, PgNftStakeUpdate> :
    T extends COL.TRANSACTION ? IDocument<Transaction, PgTransaction, PgTransactionUpdate> :
    T extends COL.AUCTION ? IDocument<Auction, PgAuction, PgAuctionUpdate> :
    T extends COL.AWARD ? IDocument<Award, PgAward, PgAwardUpdate> :
    T extends COL.TOKEN ? IDocument<Token, PgToken, PgTokenUpdate> :
    T extends COL.PROPOSAL ? IDocument<Proposal, PgProposal, PgProposalUpdate> :
    T extends COL.STAKE_REWARD ? IDocument<StakeReward, PgStakeReward, PgStakeRewardUpdate> :
    T extends COL.STAMP ? IDocument<Stamp, PgStamp, PgStampUpdate> :
    T extends COL.SWAP ? IDocument<Swap, PgSwap, PgSwapUpdate> :
    T extends COL.AIRDROP ? IDocument<TokenDrop, PgAirdrop, PgAirdropUpdate> :
    T extends COL.TOKEN_MARKET ? IDocument<TokenTradeOrder, PgTokenMarket, PgTokenMarketUpdate> :
    T extends COL.STAKE ? IDocument<Stake, PgStake, PgStakeUpdate> :
    T extends COL.TOKEN_PURCHASE ? IDocument<TokenPurchase, PgTokenPurchase, PgTokenPurchaseUpdate> :
    T extends COL.MNEMONIC ? IDocument<Mnemonic, PgMnemonic, PgMnemonicUpdate> :
    T extends COL.NOTIFICATION ? IDocument<Notification, PgNotification, PgNotificationUpdate> :
    T extends COL.SYSTEM ? IDocument<SystemConfig, PgSystem, PgSystemUpdate> :
    T extends COL.TICKER ? IDocument<Ticker, PgTicker, PgTickerUpdate> :
    T extends COL.SOON_SNAP ? IDocument<SoonSnap, PgSoonSnapshot, PgSoonSnapshotUpdate> :
    T extends COL.MILESTONE ? IDocument<PgMilestone, PgMilestone, PgMilestoneUpdate> :
    T extends COL.MILESTONE_SMR ? IDocument<PgMilestone, PgMilestone, PgMilestoneUpdate> :
    T extends COL.MILESTONE_RMS ? IDocument<PgMilestone, PgMilestone, PgMilestoneUpdate> :
    unknown :
  S extends SUB_COL.OWNERS ? 
    T extends COL.AWARD ? IDocument<AwardOwner, PgAwardOwners, PgAwardOwnersUpdate> :
    T extends COL.PROPOSAL ? IDocument<ProposalMember, PgProposalOwners, PgProposalOwnersUpdate> :
    undefined:
  S extends SUB_COL.PARTICIPANTS ? 
    T extends COL.AWARD ? IDocument<AwardParticipant, PgAwardParticipants, PgAwardParticipantsUpdate> :
    undefined :
  S extends SUB_COL.MEMBERS ? 
    T extends COL.SPACE ? IDocument<SpaceMember, PgSpaceMembers, PgSpaceMembersUpdate> :
    T extends COL.PROPOSAL ? IDocument<ProposalMember, PgProposalMembers, PgProposalMembersUpdate> :
    undefined :
  S extends SUB_COL.BLOCKED_MEMBERS ? 
    T extends COL.SPACE ? IDocument<SpaceMember, PgSpaceMembers, PgSpaceMembersUpdate> :
    undefined :
  S extends SUB_COL.KNOCKING_MEMBERS ? 
    T extends COL.SPACE ? IDocument<SpaceMember, PgSpaceMembers, PgSpaceMembersUpdate> :
    undefined :
  S extends SUB_COL.GUARDIANS ? 
    T extends COL.SPACE ? IDocument<SpaceGuardian, PgSpaceGuardians, PgSpaceGuardiansUpdate> :
    undefined :
  S extends SUB_COL.DISTRIBUTION ?
    T extends COL.TOKEN ? ISubDocument<TokenDistribution, PgTokenDistribution, PgTokenDistributionUpdate> :
    undefined :
  S extends SUB_COL.STATS ?
    T extends COL.TOKEN ? IDocument<TokenStats, PgTokenStats, PgTokenStatsUpdate> :
    T extends COL.COLLECTION ? IDocument<CollectionStats, PgCollectionStats, PgCollectionStatsUpdate> :
    undefined :
  S extends SUB_COL.RANKS ?
    T extends COL.TOKEN ? IDocument<Rank, PgTokenRanks, PgTokenRanksUpdate> :
    T extends COL.COLLECTION ? IDocument<Rank, PgCollectionRanks,PgCollectionRanksUpdate> :
  undefined :
  S extends SUB_COL.VOTES ?
    T extends COL.TOKEN ? IDocument<Vote, PgTokenVotes, PgTokenVotesUpdate> :
    T extends COL.COLLECTION ? IDocument<Vote, PgCollectionVotes, PgCollectionVotesUpdate> :
    undefined :
  S extends SUB_COL.ADMINS ?
    T extends COL.PROJECT ? IDocument<ProjectAdmin, PgProjectAdmins, PgProjectAdminsUpdate> :
    undefined :
  S extends SUB_COL._API_KEY ?
    T extends COL.PROJECT ? IDocument<ProjectApiKey, PgProjectApiKey, PgProjectApiKeyUpdate> :
    undefined :
  S extends SUB_COL.TRANSACTIONS ? ISubDocument<MilestoneTransactions, PgMilestoneTransactions, PgMilestoneTransactionsUpdate> :
undefined;

export class PgDatabase implements IDatabase {
  private readonly con: Knex;

  constructor() {
    this.con = getKnex();
  }

  private getConverter = (col: COL, subCol?: SUB_COL) => {
    if (!subCol) {
      switch (col) {
        case COL.MEMBER:
          return new MemberConverter();
        case COL.SPACE:
          return new SpaceConverter();
        case COL.PROJECT:
          return new ProjectConverter();
        case COL.COLLECTION:
          return new CollectionConverter();
        case COL.NFT:
          return new NftConverter();
        case COL.NFT_STAKE:
          return new NftStakeConverter();
        case COL.TRANSACTION:
          return new TransactionConverter();
        case COL.AUCTION:
          return new AuctionConverter();
        case COL.AWARD:
          return new AwardConverter();
        case COL.TOKEN:
          return new TokenConverter();
        case COL.PROPOSAL:
          return new ProposalConverter();
        case COL.STAKE_REWARD:
          return new StakeRewardConverter();
        case COL.STAMP:
          return new StampConverter();
        case COL.SWAP:
          return new SwapConverter();
        case COL.AIRDROP:
          return new AirdropConverter();
        case COL.TOKEN_MARKET:
          return new TokenTradeOrderConverter();
        case COL.STAKE:
          return new StakeConverter();
        case COL.TOKEN_PURCHASE:
          return new TokenPurchaseConverter();
        case COL.MNEMONIC:
          return new MnemonicConverter();
        case COL.NOTIFICATION:
          return new NotificationConverter();
        case COL.SYSTEM:
          return new SystemConverter();
        case COL.TICKER:
          return new TickerConverter();
        case COL.SOON_SNAP:
          return new SoonSnapshotConverter();
        case COL.MILESTONE:
          return new MilestoneConverter();
        case COL.MILESTONE_RMS:
          return new MilestoneConverter();
        case COL.MILESTONE_SMR:
          return new MilestoneConverter();
        default:
          throw Error(`Invalid paramas ${col}, ${subCol}`);
      }
    }
    if (col === COL.SPACE) {
      if (subCol === SUB_COL.MEMBERS) return new SpaceMemberConverter();
      if (subCol === SUB_COL.BLOCKED_MEMBERS) return new SpaceMemberConverter();
      if (subCol === SUB_COL.KNOCKING_MEMBERS) return new SpaceMemberConverter();
      if (subCol === SUB_COL.GUARDIANS) return new SpaceMemberConverter();
    }
    if (col === COL.AWARD) {
      if (subCol === SUB_COL.OWNERS) return new AwardOwnerConverter();
      if (subCol === SUB_COL.PARTICIPANTS) return new AwardParticipantConverter();
    }
    if (col === COL.PROPOSAL) {
      if (subCol === SUB_COL.OWNERS) return new ProposalOwnerConverter();
      if (subCol === SUB_COL.MEMBERS) return new ProposalMemberConverter();
    }
    if (col === COL.TOKEN) {
      if (subCol === SUB_COL.DISTRIBUTION) return new TokenDistributionConverter();
      if (subCol === SUB_COL.STATS) return new TokenStatsConverter();
      if (subCol === SUB_COL.RANKS) return new TokenRankConverter();
      if (subCol === SUB_COL.VOTES) return new TokenVotesConverter();
    }
    if (col === COL.COLLECTION) {
      if (subCol === SUB_COL.STATS) return new CollectionStatsConverter();
      if (subCol === SUB_COL.RANKS) return new CollectionRankConverter();
      if (subCol === SUB_COL.VOTES) return new CollectionVotesConverter();
    }
    if (col === COL.PROJECT) {
      if (subCol === SUB_COL.ADMINS) return new ProjectAdminConverter();
      if (subCol === SUB_COL._API_KEY) return new ProjectApiKeyConverter();
    }
    if (subCol === SUB_COL.TRANSACTIONS) {
      return new MilestoneTransactionConverter();
    }
    throw Error(`No converter ${col},  ${subCol}`);
  };

  collection = <C extends COL, S extends SUB_COL | undefined = undefined>(
    col: C,
    colId?: string,
    subCol?: S,
  ): IColType<C, S> => {
    const converter: Converter<any, any> = this.getConverter(col, subCol);
    if (subCol) {
      if (col === COL.TOKEN && subCol === SUB_COL.DISTRIBUTION) {
        return new PgTokenDistributionCollection(
          this.con,
          col,
          colId,
          subCol,
          converter,
        ) as unknown as IColType<C, S>;
      }
      return new ISubCollection(this.con, col, colId, subCol, converter) as IColType<C, S>;
    }

    if (col === COL.AIRDROP) {
      return new PgAirdropCollection(this.con, col, converter) as IColType<C, S>;
    }
    if (col === COL.COLLECTION) {
      return new PgCollectionCollection(this.con, col, converter) as IColType<C, S>;
    }
    if (col === COL.STAKE) {
      return new PgStakeCollection(this.con, col, converter) as unknown as IColType<C, S>;
    }

    return new ICollection(this.con, col, converter) as IColType<C, S>;
  };

  doc = <C extends COL, S extends SUB_COL | undefined = undefined>(
    col: C,
    colId: string,
    subCol?: S,
    subColId?: string,
  ): IDocType<C, S> => {
    return subCol && subColId
      ? (this.collection(col, colId, subCol)!.doc(subColId) as IDocType<C, S>)
      : (this.collection(col)!.doc(colId) as IDocType<C, S>);
  };

  batch = (): IBatch => new PgBatch(this.con);

  runTransaction = async <T>(func: (transaction: ITransaction) => Promise<T>) => {
    for (let i = 0; i < 240; ++i) {
      const con = getKnexTran();
      let trx: Knex.Transaction | undefined = undefined;
      try {
        trx = await con.transaction();
        const transaction = new PgRunTransaction(trx);
        const result = await func(transaction);
        if (transaction.allLocksAquired) {
          await trx.commit();
          return result;
        } else {
          await trx.rollback();
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 300)));
        }
      } catch (err) {
        await trx?.rollback();
        throw err;
      } finally {
        await con.destroy();
      }
    }
    throw { code: 500, key: 'Failed to execute transaction' };
  };

  inc = (value: number) => new Increment(value);

  arrayUnion = <T>(value: T) => new ArrayUnion(value);

  arrayRemove = <T>(value: T) => new ArrayRemove(value);

  destroy = async () => {
    const promises: any[] = [knex?.destroy(), knextran?.destroy()];

    for (const subs of Object.values(subscriptions)) {
      promises.push((await subs).delete());
    }

    await Promise.allSettled(promises);
  };

  getCon = () => this.con;
}

export const pgDateToTimestamp = (date: Date | string | undefined) =>
  date ? Timestamp.fromDate(dayjs(date).toDate()) : undefined;

enum BatchAction {
  C = 'create',
  U = 'update',
  UPS = 'upsert',
  D = 'delete',
}

export class PgBatch implements IBatch {
  private changes: { docRef: IDocument<any, any, any>; data: any; action: BatchAction }[] = [];
  constructor(private readonly con: Knex) {}

  create = <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>, data: C) => {
    this.changes.push({ docRef, data, action: BatchAction.C });
  };

  update = <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>, data: U) => {
    this.changes.push({ docRef, data, action: BatchAction.U });
  };

  upsert = <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>, data: U) => {
    this.changes.push({ docRef, data, action: BatchAction.UPS });
  };

  delete = <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>) => {
    this.changes.push({ docRef, data: undefined, action: BatchAction.D });
  };

  commit = async () => {
    const trx = await this.con.transaction();
    try {
      for (const { docRef, data, action } of this.changes) {
        switch (action) {
          case BatchAction.C:
            await docRef.useTransaction(trx, (doc) => doc.create(data));
            break;
          case BatchAction.U:
            await docRef.useTransaction(trx, (doc) => doc.update(data));
            break;
          case BatchAction.UPS:
            await docRef.useTransaction(trx, (doc) => doc.upsert(data));
            break;
          case BatchAction.D:
            await docRef.useTransaction(trx, (doc) => doc.delete());
            break;
        }
      }
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  };
}

export class PgRunTransaction implements ITransaction {
  public allLocksAquired = true;
  constructor(private readonly trx: Knex.Transaction) {}

  create = async <C, B extends BaseRecord, U extends Update>(
    docRef: IDocument<C, B, U>,
    data: C,
  ) => {
    if (!this.allLocksAquired) {
      return;
    }
    await docRef.useTransaction(this.trx, (doc) => doc.create(data));
  };

  update = async <C, B extends BaseRecord, U extends Update>(
    docRef: IDocument<C, B, U>,
    data: U,
  ) => {
    if (!this.allLocksAquired) {
      return;
    }
    await docRef.useTransaction(this.trx, (doc) => doc.update(data));
  };

  upsert = async <C, B extends BaseRecord, U extends Update>(
    docRef: IDocument<C, B, U>,
    data: U,
  ) => {
    if (!this.allLocksAquired) {
      return;
    }
    await docRef.useTransaction(this.trx, (doc) => doc.upsert(data));
  };

  delete = async <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>) => {
    if (!this.allLocksAquired) {
      return;
    }
    await docRef.useTransaction(this.trx, (doc) => doc.delete());
  };

  get = async <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>) => {
    if (!this.allLocksAquired) {
      return await docRef.get();
    }
    try {
      return await docRef.useTransaction(this.trx, (doc) => doc.get());
    } catch {
      this.allLocksAquired = false;
      return await docRef.get();
    }
  };

  getAll = async <C, B extends BaseRecord, U extends Update>(...docRefs: IDocument<C, B, U>[]) => {
    if (!this.allLocksAquired) {
      return [];
    }
    const promises = docRefs.map((docRef) => this.get(docRef));
    return await Promise.all(promises);
  };
}
