import { database } from '@buildcore/database';
import {
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  Member,
  Proposal,
  ProposalType,
  SUB_COL,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { getAddress } from '../../../utils/address.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { BaseService, HandlerParams } from '../base';
import { Action } from '../transaction-service';

export class SpaceAddressService extends BaseService {
  public handleRequest = async ({ project, order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    await this.transactionService.createCredit(
      TransactionPayloadType.ADDRESS_VALIDATION,
      payment,
      match,
    );
    this.transactionService.markAsReconciled(order, match.msgId);

    const spaceDocRef = database().doc(COL.SPACE, order.space!);
    const space = await this.transaction.get(spaceDocRef);

    const ownerDocRef = database().doc(COL.MEMBER, order.member!);
    const owner = <Member>await this.transaction.get(ownerDocRef);

    const guardians = await database().collection(COL.SPACE, order.space!, SUB_COL.GUARDIANS).get();
    const proposal = createUpdateSpaceValidatedAddressProposal(
      project,
      order,
      match.from,
      owner,
      space!,
      guardians.length,
    );

    const voteTransaction = {
      project,
      type: TransactionType.VOTE,
      uid: getRandomEthAddress(),
      member: owner!.uid,
      space: space!.uid,
      network: DEFAULT_NETWORK,
      payload: {
        proposalId: proposal.uid,
        weight: 1,
        values: [1],
        votes: [],
      },
      linkedTransactions: [],
    };

    for (const guardian of guardians) {
      const memberDocRef = database().doc(
        COL.PROPOSAL,
        proposal.uid,
        SUB_COL.MEMBERS,
        guardian.uid,
      );
      this.transactionService.push({
        ref: memberDocRef,
        data: {
          weight: 1,
          voted: guardian.uid === owner.uid,
          tranId: guardian.uid === owner.uid ? voteTransaction.uid : '',
        },
        action: Action.UPS,
      });
    }

    const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);

    this.transactionService.push({
      ref: proposalDocRef,
      data: proposal,
      action: Action.C,
    });

    const voteTransactionDocRef = database().doc(COL.TRANSACTION, voteTransaction.uid);
    this.transactionService.push({
      ref: voteTransactionDocRef,
      data: voteTransaction,
      action: Action.C,
    });
  };
}

const createUpdateSpaceValidatedAddressProposal = (
  project: string,
  order: Transaction,
  validatedAddress: string,
  owner: Member,
  space: Space,
  guardiansCount: number,
): Proposal => {
  const additionalInfo =
    `${owner.name || owner.uid} wants to update the space's validated address. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
    `${UPDATE_SPACE_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`;
  const prevAddress = getAddress(space, order.network!);
  return {
    project,
    createdBy: owner.uid,
    uid: getRandomEthAddress(),
    name: 'Update validated address',
    additionalInfo: additionalInfo,
    space: space.uid,
    description: '',
    type: ProposalType.EDIT_SPACE,
    approved: true,
    rejected: false,
    settings: {
      startDate: dateToTimestamp(dayjs().toDate()),
      endDate: dateToTimestamp(dayjs().add(1, 'w').toDate()),
      guardiansOnly: true,
      spaceUpdateData: {
        uid: space.uid,
        validatedAddress: { [order.network!]: validatedAddress },
        prevValidatedAddresses: prevAddress ? [prevAddress] : [],
      },
    },
    questions: [
      {
        text: "Do you want to update the space's validate address?",
        additionalInfo: `${order.network!.toUpperCase()}: ${validatedAddress} (previously: ${getAddress(space, order.network!) || 'None'})\n`,
        answers: [
          {
            text: 'No',
            value: BaseProposalAnswerValue.NO,
            additionalInfo: '',
          },
          {
            text: 'Yes',
            value: BaseProposalAnswerValue.YES,
            additionalInfo: '',
          },
        ],
      },
    ],
    totalWeight: guardiansCount,
    results: {
      total: guardiansCount,
      voted: 1,
      answers: { [1]: 1 },
    },
    completed: false,
  };
};
