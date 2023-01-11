import {
  COL,
  Proposal,
  SUB_COL,
  Transaction,
  TransactionOrder,
  TransactionType,
  VoteTransaction,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import admin, { inc } from '../../admin.config';
import { getTokenForSpace } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class VotingService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleTokenVoteRequest(order: TransactionOrder, match: TransactionMatch) {
    const payment = this.transactionService.createPayment(order, match);
    await this.transactionService.markAsReconciled(order, match.msgId);
    const token = await getTokenForSpace(order.space!);
    const nativeTokens = match.to.nativeTokens || [];

    const hasValidToken = nativeTokens[0].id === token?.mintingData?.tokenId;
    const proposalId = get(order, 'payload.proposalId', '');
    const values = get(order, 'payload.voteValues', []);
    const customData = hasValidToken ? { proposalId, values } : undefined;
    const credit = this.transactionService.createCredit(
      payment,
      match,
      undefined,
      undefined,
      undefined,
      customData,
    );

    if (!hasValidToken) {
      return;
    }

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposalId}`);
    const proposal = <Proposal>(await proposalDocRef.get()).data();

    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(order.member!);

    const tokenAmount = Number(nativeTokens[0].amount);
    const weightMultiplier = getMultiplier(proposal);
    const weight = tokenAmount * weightMultiplier;

    const voteTransaction = this.createVoteTransaction(
      order,
      credit!,
      proposal,
      tokenAmount,
      weightMultiplier,
      values,
    );

    this.transactionService.updates.push({
      ref: proposalMemberDocRef,
      data: {
        voted: true,
        voteTransactions: inc(1),
        tranId: voteTransaction.uid,
        weight: inc(weight),
        values: admin.firestore.FieldValue.arrayUnion({
          [values[0]]: weight,
          voteTransaction: voteTransaction.uid,
        }),
      },
      action: 'update',
    });

    const data = {
      results: {
        total: inc(weight),
        voted: inc(weight),
        answers: { [`${values[0]}`]: inc(weight) },
      },
    };
    this.transactionService.updates.push({
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
      },
      linkedTransactions: [],
    };

    const voteTransactionDocRef = admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    this.transactionService.updates.push({
      ref: voteTransactionDocRef,
      data: voteTransaction,
      action: 'set',
    });
    return voteTransaction;
  };
}

const getMultiplier = (proposal: Proposal) => {
  const startDate = dayjs(proposal.settings.startDate.toDate());
  const endDate = dayjs(proposal.settings.endDate.toDate());
  const votedOn = dayjs().isBefore(startDate) ? startDate : dayjs();
  const multiplier = endDate.diff(votedOn) / endDate.diff(startDate);
  return Number(multiplier.toFixed(2));
};
