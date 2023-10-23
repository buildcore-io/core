import { build5Db, getSnapshot } from '@build-5/database';
import {
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  Entity,
  Member,
  Network,
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
import { last } from 'lodash';
import { getAddress } from '../../utils/address.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class AddressService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleAddressValidationRequest(
    order: Transaction,
    match: TransactionMatch,
    type: Entity,
  ) {
    const payment = await this.transactionService.createPayment(order, match);
    const credit = await this.transactionService.createCredit(
      TransactionPayloadType.ADDRESS_VALIDATION,
      payment,
      match,
    );
    if (credit) {
      await this.setValidatedAddress(credit, type);
      if (type === Entity.MEMBER) {
        await claimBadges(
          order.member!,
          credit.payload.targetAddress!,
          order.network || DEFAULT_NETWORK,
        );
      }
    }
    this.transactionService.markAsReconciled(order, match.msgId);
  }

  public async handleSpaceAddressValidationRequest(order: Transaction, match: TransactionMatch) {
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
      order,
      match.from,
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
  }

  private async setValidatedAddress(credit: Transaction, type: Entity): Promise<void> {
    const collection = type === Entity.MEMBER ? COL.MEMBER : COL.SPACE;
    const id = type === Entity.MEMBER ? credit.member : credit.space;
    const ref = build5Db().doc(`${collection}/${id}`);
    const docData = await ref.get<Record<string, unknown>>();
    const network = credit.network || DEFAULT_NETWORK;
    const currentAddress = getAddress(docData, network);
    const data = { [`validatedAddress.${network}`]: credit.payload.targetAddress };
    if (currentAddress) {
      data.prevValidatedAddresses = build5Db().arrayUnion(currentAddress);
    }
    this.transactionService.push({ ref, data, action: 'update' });
  }
}

const claimBadges = async (member: string, memberAddress: string, network: Network) => {
  let lastDocId = '';
  do {
    const lastDoc = await getSnapshot(COL.TRANSACTION, lastDocId);
    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('network', '==', network)
      .where('type', '==', TransactionType.AWARD)
      .where('member', '==', member)
      .where('ignoreWallet', '==', true)
      .where('payload.type', '==', TransactionPayloadType.BADGE)
      .limit(500)
      .startAfter(lastDoc)
      .get<Transaction>();
    lastDocId = last(snap)?.uid || '';

    const promises = snap.map((badgeTransaction) =>
      updateBadgeTransaction(badgeTransaction.uid, memberAddress),
    );
    await Promise.all(promises);
  } while (lastDocId);
};

const updateBadgeTransaction = async (transactionId: string, memberAddress: string) =>
  build5Db().runTransaction(async (transaction) => {
    const badgeDocRef = build5Db().doc(`${COL.TRANSACTION}/${transactionId}`);
    const badge = await transaction.get<Transaction>(badgeDocRef);
    if (badge?.ignoreWallet) {
      const data = {
        ignoreWallet: false,
        'payload.targetAddress': memberAddress,
        shouldRetry: true,
      };
      transaction.update(badgeDocRef, data);
    }
  });

const createUpdateSpaceValidatedAddressProposal = (
  order: Transaction,
  validatedAddress: string,
  owner: Member,
  space: Space,
  guardiansCount: number,
) => {
  const additionalInfo =
    `${owner.name || owner.uid} wants to update the space's validated address. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
    `${UPDATE_SPACE_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`;
  return <Proposal>{
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
