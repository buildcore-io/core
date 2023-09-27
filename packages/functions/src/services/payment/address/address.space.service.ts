import { build5Db } from '@build-5/database';
import {
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  Member,
  Proposal,
  ProposalType,
  SUB_COL,
  Space,
  SpaceGuardian,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getAddress } from '../../../utils/address.utils';
import { getProjects } from '../../../utils/common.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { BaseService, HandlerParams } from '../base';

export class SpaceAddressService extends BaseService {
  public handleRequest = async ({ project, order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    await this.transactionService.createCredit(
      TransactionPayloadType.ADDRESS_VALIDATION,
      payment,
      match,
    );
    this.transactionService.markAsReconciled(order, match.msgId);

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${order.space}`);
    const space = await this.transactionService.get<Space>(spaceDocRef);

    const ownerDocRef = build5Db().doc(`${COL.MEMBER}/${order.member}`);
    const owner = <Member>await ownerDocRef.get();

    const guardians = await spaceDocRef.collection(SUB_COL.GUARDIANS).get<SpaceGuardian>();
    const proposal = createUpdateSpaceValidatedAddressProposal(
      project,
      order,
      match.from.address,
      owner,
      space!,
      guardians.length,
    );

    const voteTransaction = {
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

    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const memberPromisses = guardians.map((guardian) => {
      proposalDocRef
        .collection(SUB_COL.MEMBERS)
        .doc(guardian.uid)
        .set({
          uid: guardian.uid,
          weight: 1,
          voted: guardian.uid === owner.uid,
          tranId: guardian.uid === owner.uid ? voteTransaction.uid : '',
          parentId: proposal.uid,
          parentCol: COL.PROPOSAL,
          values: guardian.uid === owner.uid ? [{ [1]: 1 }] : [],
        });
    });
    await Promise.all(memberPromisses);

    const voteTransactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    this.transactionService.push({
      ref: voteTransactionDocRef,
      data: voteTransaction,
      action: 'set',
    });

    this.transactionService.push({
      ref: proposalDocRef,
      data: proposal,
      action: 'set',
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
  return {
    project,
    projects: getProjects([order], project),
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
        prevValidatedAddresses: getAddress(space, order.network!),
      },
    },
    questions: [
      {
        text: "Do you want to update the space's validate address?",
        additionalInfo: `${order.network!.toUpperCase()}: ${validatedAddress} (previously: ${
          getAddress(space, order.network!) || 'None'
        })\n`,
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
  };
};
