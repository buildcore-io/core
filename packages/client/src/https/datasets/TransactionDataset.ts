import {
  ApiRoutes,
  CreditUnrefundableRequest,
  Dataset,
  GetManyAdvancedRequest,
  GetManyRequest,
  Nft,
  Opr,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import { head } from 'lodash';
import { of, switchMap } from 'rxjs';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import { fetchLive } from '../get/observable';
import { DatasetClass } from './Dataset';

export class TransactionDataset<D extends Dataset> extends DatasetClass<D, Transaction> {
  creditUnrefundable = this.sendRequest(WEN_FUNC.creditUnrefundable)<
    CreditUnrefundableRequest,
    Transaction
  >;

  getBadgesForMemberLive = (member: string, orderBy = ['createdOn'], startAfter?: string) => {
    const fieldName = ['member', 'type', 'payload.type'];
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName,
      fieldValue: [member, TransactionType.AWARD, TransactionPayloadType.BADGE],
      operator: fieldName.map(() => Opr.EQUAL),
      startAfter,
      orderBy,
      orderByDir: orderBy.map(() => 'desc'),
    };
    return this.getManyAdvancedLive(params);
  };

  getTopTransactionsLive = (
    orderBy = ['createdOn'],
    startAfter?: string,
    member?: string,
    previousOwner?: string,
  ) => {
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
    const fieldName = includedTypes.map(() => 'type');
    const fieldValue: string[] = includedTypes;
    const operator = includedTypes.map(() => Opr.IN);
    if (member) {
      fieldName.push('member');
      fieldValue.push(member);
      operator.push(Opr.EQUAL);
    }
    if (previousOwner) {
      fieldName.push('payload.previousOwner');
      fieldValue.push(previousOwner);
      operator.push(Opr.EQUAL);
    }
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName,
      fieldValue,
      operator,
      startAfter,
      orderBy,
      orderByDir: orderBy.map(() => 'desc'),
    };
    return this.getManyAdvancedLive(params);
  };

  getNftOffersLive = (nft: Nft, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
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

  getMembersBidsLive = (member: string, nft: Nft, currentAuction = false, startAfter?: string) => {
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
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName,
      fieldValue,
      operator,
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getLatestVotesForProposalLive = (proposal: string, member?: string, startAfter?: string) => {
    const fieldName = ['payload.proposalId', 'type'];
    const fieldValue = [proposal, TransactionType.VOTE];
    const operator = [Opr.EQUAL, Opr.EQUAL];
    if (member) {
      fieldName.push('member');
      fieldValue.push(member);
      operator.push(Opr.EQUAL);
    }
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName,
      fieldValue,
      operator,
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getPaymentByTagLive = (tag: string) => {
    const params: GetManyRequest = {
      dataset: this.dataset,
      fieldName: ['type', 'payload.tag'],
      fieldValue: [TransactionType.PAYMENT, tag],
    };
    const url = this.origin + ApiRoutes.GET_MANY + toQueryParams({ ...params });
    return fetchLive<Transaction[]>(this.apiKey, url).pipe(switchMap((r) => of(head(r))));
  };

  getBySourceTransaction = async (sourceTransaction: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['payload.sourceTransaction'],
      fieldValue: [sourceTransaction],
      operator: [Opr.ARRAY_CONTAINS],
    };
    return await wrappedFetch<Transaction[]>(
      this.apiKey,
      this.origin + ApiRoutes.GET_MANY_ADVANCED,
      { ...params },
    );
  };
}
