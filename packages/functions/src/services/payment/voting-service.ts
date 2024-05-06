import { database } from '@buildcore/database';
import {
  COL,
  Proposal,
  SUB_COL,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { head } from 'lodash';
import { getProject } from '../../utils/common.utils';
import { getTokenForSpace } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { BaseService, HandlerParams } from './base';
import { Action } from './transaction-service';

export class VotingService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    this.transactionService.markAsReconciled(order, match.msgId);
    const token = await getTokenForSpace(order.space!);
    const nativeTokens = match.to.nativeTokens || [];

    const hasValidToken = head(nativeTokens)?.id === token?.mintingData?.tokenId;
    const proposalId = order.payload.proposalId || '';
    const values = order.payload.voteValues || [];
    const customData = hasValidToken ? { proposalId, values } : undefined;

    const storageReturn = match.to.amount >= order.payload.amount! ? match.from : undefined;
    const credit = await this.transactionService.createCredit(
      TransactionPayloadType.TOKEN_VOTE,
      payment,
      match,
      undefined,
      undefined,
      undefined,
      storageReturn
        ? {
            address: storageReturn,
            amount: order.payload.amount!,
          }
        : undefined,
      customData,
    );

    if (!hasValidToken) {
      return;
    }

    const proposalDocRef = database().doc(COL.PROPOSAL, proposalId);
    const proposal = <Proposal>await proposalDocRef.get();

    const proposalMemberDocRef = database().doc(
      COL.PROPOSAL,
      proposalId,
      SUB_COL.MEMBERS,
      order.member!,
    );

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

    const value = values[0].toString();
    this.transactionService.push({
      ref: proposalMemberDocRef,
      data: {
        voted: true,
        parentId: proposalId,
        tranId: voteTransaction.uid,
        weight,
        values: { [voteTransaction.uid]: { value, weight: database().inc(weight) } },
      },
      action: Action.UPS,
    });

    this.transactionService.push({
      ref: proposalDocRef,
      data: {
        results: {
          total: database().inc(weight),
          voted: database().inc(weight),
          answers: { [value]: database().inc(weight) },
        },
      },
      action: Action.U,
    });
  };

  private createVoteTransaction = (
    order: Transaction,
    credit: Transaction,
    proposal: Proposal,
    tokenAmount: number,
    weightMultiplier: number,
    values: number[],
  ) => {
    const voteTransaction: Transaction = {
      project: getProject(order),
      type: TransactionType.VOTE,
      uid: getRandomEthAddress(),
      member: order.member,
      space: proposal.space,
      network: order.network,
      payload: {
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

    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, voteTransaction.uid),
      data: voteTransaction,
      action: Action.C,
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
