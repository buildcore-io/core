import {
  COL,
  Proposal,
  SUB_COL,
  Transaction,
  TransactionCreditType,
  TransactionOrder,
  TransactionType,
  VoteTransaction,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get, head } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import { getTokenForSpace } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class VotingService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleTokenVoteRequest(order: TransactionOrder, match: TransactionMatch) {
    const payment = await this.transactionService.createPayment(order, match);
    this.transactionService.markAsReconciled(order, match.msgId);
    const token = await getTokenForSpace(order.space!);
    const nativeTokens = match.to.nativeTokens || [];

    const hasValidToken = head(nativeTokens)?.id === token?.mintingData?.tokenId;
    const proposalId = get(order, 'payload.proposalId', '');
    const values = get(order, 'payload.voteValues', []);
    const customData = hasValidToken ? { proposalId, values } : undefined;

    const storageReturn = match.to.amount >= order.payload.amount ? match.from.address : undefined;
    const credit = await this.transactionService.createCredit(
      TransactionCreditType.TOKEN_VOTE,
      payment,
      match,
      undefined,
      undefined,
      undefined,
      storageReturn
        ? {
            address: storageReturn,
            amount: order.payload.amount,
          }
        : undefined,
      customData,
    );

    if (!hasValidToken) {
      return;
    }

    const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposalId}`);
    const proposal = <Proposal>await proposalDocRef.get();

    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(order.member!);

    const tokenAmount = Number(nativeTokens[0].amount);
    const weightMultiplier = getTokenVoteMultiplier(proposal, dayjs());
    const weight = tokenAmount * weightMultiplier;

    const voteTransaction = this.createVoteTransaction(
      order,
      credit!,
      proposal,
      tokenAmount,
      weightMultiplier,
      values,
    );

    this.transactionService.push({
      ref: proposalMemberDocRef,
      data: {
        voted: true,
        voteTransactions: soonDb().inc(1),
        tranId: voteTransaction.uid,
        weightPerAnswer: { [values[0]]: soonDb().inc(weight) },
        values: soonDb().arrayUnion({
          [values[0]]: weight,
          voteTransaction: voteTransaction.uid,
        }),
      },
      action: 'set',
      merge: true,
    });

    const data = {
      results: {
        total: soonDb().inc(weight),
        voted: soonDb().inc(weight),
        answers: { [`${values[0]}`]: soonDb().inc(weight) },
      },
    };
    this.transactionService.push({
      ref: proposalDocRef,
      data,
      action: 'set',
      merge: true,
    });
  }

  private createVoteTransaction = (
    order: TransactionOrder,
    credit: Transaction,
    proposal: Proposal,
    tokenAmount: number,
    weightMultiplier: number,
    values: number[],
  ) => {
    const voteTransaction = <Transaction>{
      type: TransactionType.VOTE,
      uid: getRandomEthAddress(),
      member: order.member,
      space: proposal.space,
      network: order.network,
      payload: <VoteTransaction>{
        proposalId: proposal.uid,
        tokenAmount,
        weightMultiplier,
        weight: tokenAmount * weightMultiplier,
        values,
        votes: [],
        creditId: credit.uid,
        outputConsumed: false,
      },
      linkedTransactions: [],
    };

    const voteTransactionDocRef = soonDb().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    this.transactionService.push({
      ref: voteTransactionDocRef,
      data: voteTransaction,
      action: 'set',
    });
    return voteTransaction;
  };
}

export const getTokenVoteMultiplier = (
  proposal: Proposal,
  voteCreatedOn: dayjs.Dayjs,
  consumedOn?: dayjs.Dayjs,
) => {
  const startDate = dayjs(proposal.settings.startDate.toDate());
  const endDate = dayjs(proposal.settings.endDate.toDate());
  const votedOn = voteCreatedOn.isBefore(startDate) ? startDate : voteCreatedOn;
  const consumed = (consumedOn || endDate).isBefore(votedOn) ? votedOn : consumedOn || endDate;
  return consumed.diff(votedOn) / endDate.diff(startDate);
};
