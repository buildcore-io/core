import {
  Nft,
  Opr,
  PublicCollections,
  Transaction,
  TransactionAwardType,
  TransactionType,
} from '@soonaverse/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class TransactionRepository extends CrudRepository<Transaction> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TRANSACTION);
  }

  public getBadgesForMemberLive = (
    member: string,
    orderBy: string[] = ['createdOn'],
    startAfter?: string,
  ) => {
    const fieldName = ['member', 'type', 'payload.type'];
    const params = {
      collection: this.col,
      fieldName,
      fieldValue: [member, TransactionType.AWARD, TransactionAwardType.BADGE],
      operator: fieldName.map(() => Opr.EQUAL),
      startAfter,
      orderBy,
      orderByDir: orderBy.map(() => 'desc'),
    };
    return this.getManyAdvancedLive(params);
  };

  public getTopLive = (orderBy: string[] = ['createdOn'], startAfter?: string) => {
    const includedTypes = [
      TransactionType.PAYMENT,
      TransactionType.BILL_PAYMENT,
      TransactionType.CREDIT,
      TransactionType.CREDIT_NFT,
      TransactionType.MINT_COLLECTION,
      TransactionType.WITHDRAW_NFT,
      TransactionType.MINT_TOKEN,
      TransactionType.UNLOCK,
      TransactionType.CREDIT_TANGLE_REQUEST,
      TransactionType.VOTE,
    ];
    const params = {
      collection: this.col,
      fieldName: includedTypes.map(() => 'type'),
      fieldValue: includedTypes,
      operator: includedTypes.map(() => Opr.IN),
      startAfter,
      orderBy,
      orderByDir: orderBy.map(() => 'desc'),
    };
    return this.getManyAdvancedLive(params);
  };

  public getNftOffersLive = (nft: Nft, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['type', 'payload.nft', 'createdOn', 'createdOn'],
      fieldValue: [
        TransactionType.PAYMENT,
        nft.uid,
        nft.auctionTo!.toDate().toISOString(),
        nft.auctionFrom!.toDate().toISOString(),
      ],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.LESS, Opr.GREATER],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getMembersBidsLive = (
    member: string,
    nft: Nft,
    currentAuction = false,
    startAfter?: string,
  ) => {
    const fieldName = ['member', 'payload.nft', 'type', 'type'];
    const fieldValue: (string | number)[] = [
      member,
      nft.uid,
      TransactionType.PAYMENT,
      TransactionType.CREDIT,
    ];
    const operator = [Opr.EQUAL, Opr.EQUAL, Opr.IN, Opr.IN];
    if (currentAuction) {
      fieldName.push('createdOn', 'createdOn');
      fieldValue.push(
        nft.auctionTo!.toDate().toISOString(),
        nft.auctionFrom!.toDate().toISOString(),
      );
      operator.push(Opr.GREATER, Opr.LESS);
    }
    const params = {
      collection: this.col,
      fieldName,
      fieldValue,
      operator,
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getLatestVotesForProposalLive = (
    proposal: string,
    member?: string,
    startAfter?: string,
  ) => {
    const fieldName = ['payload.proposalId', 'type'];
    const fieldValue = [proposal, TransactionType.VOTE];
    const operator = [Opr.EQUAL, Opr.EQUAL];
    if (member) {
      fieldName.push('member');
      fieldValue.push(member);
      operator.push(Opr.EQUAL);
    }
    const params = {
      collection: this.col,
      fieldName,
      fieldValue,
      operator,
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
