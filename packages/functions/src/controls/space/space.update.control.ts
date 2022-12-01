import {
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  MAX_TOTAL_TOKEN_SUPPLY,
  Member,
  Proposal,
  ProposalSubType,
  ProposalType,
  Space,
  SUB_COL,
  TokenStatus,
  Transaction,
  TransactionType,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
  URL_PATHS,
  VoteTransaction,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { get, startCase } from 'lodash';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { cOn, dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync, pSchema } from '../../utils/schema.utils';
import { assertIsGuardian, getTokenForSpace } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { spaceUpsertSchema } from './space.create.control';

export const updateSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.uSpace),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.uSpace, context);
    const params = await decodeAuth(req, WEN_FUNC.uSpace);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      ...spaceUpsertSchema,
      uid: CommonJoi.uid(),
      tokenBased: Joi.boolean().allow(false, true).optional(),
      minStakedValue: Joi.when('tokenBased', {
        is: Joi.exist().valid(true),
        then: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
      }),
    });
    await assertValidationAsync(schema, params.body);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);
    const space = <Space | undefined>(await spaceDocRef.get()).data();

    if (!space) {
      throw throwInvalidArgument(WenError.space_does_not_exists);
    }

    if (params.body.tokenBased) {
      const token = await getTokenForSpace(space.uid);
      if (token?.status !== TokenStatus.MINTED) {
        throw throwInvalidArgument(WenError.token_not_minted);
      }
    }

    if (
      space.tokenBased &&
      (params.body.open !== undefined || params.body.tokenBased !== undefined)
    ) {
      throw throwInvalidArgument(WenError.token_based_space_access_can_not_be_edited);
    }

    await assertIsGuardian(space.uid, owner);

    const guardian = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data();
    const guardians = await admin
      .firestore()
      .collection(`${COL.SPACE}/${params.body.uid}/${SUB_COL.GUARDIANS}`)
      .get();
    const proposal = createUpdateSpaceProposal(
      space,
      guardian,
      params.body.uid,
      guardians.size,
      pSchema(schema, params.body),
    );

    const voteTransaction = <Transaction>{
      type: TransactionType.VOTE,
      uid: getRandomEthAddress(),
      member: owner,
      space: params.body.uid,
      network: DEFAULT_NETWORK,
      payload: <VoteTransaction>{
        proposalId: proposal.uid,
        weight: 1,
        values: [1],
        votes: [],
      },
      linkedTransactions: [],
    };

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const memberPromisses = guardians.docs.map((doc) => {
      proposalDocRef
        .collection(SUB_COL.MEMBERS)
        .doc(doc.id)
        .set(
          cOn({
            uid: doc.id,
            weight: 1,
            voted: doc.id === owner,
            tranId: doc.id === owner ? voteTransaction.uid : '',
            parentId: proposal.uid,
            parentCol: COL.PROPOSAL,
            values: doc.id === owner ? [{ [1]: 1 }] : [],
          }),
        );
    });
    await Promise.all(memberPromisses);

    await admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${voteTransaction.uid}`)
      .create(cOn(voteTransaction));

    await proposalDocRef.create(cOn(proposal, URL_PATHS.PROPOSAL));

    return <Proposal>(await proposalDocRef.get()).data();
  });

const createUpdateSpaceProposal = (
  prevSpace: Space,
  owner: Member,
  space: string,
  guardiansCount: number,
  spaceUpdateData: Space,
) => {
  const additionalInfo =
    `${owner.name} wants to edit the space. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
    `${UPDATE_SPACE_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`;
  return <Proposal>{
    createdBy: owner.uid,
    uid: getRandomEthAddress(),
    name: 'Edit space',
    additionalInfo: additionalInfo,
    space,
    description: '',
    type: ProposalType.EDIT_SPACE,
    subType: ProposalSubType.ONE_MEMBER_ONE_VOTE,
    approved: true,
    rejected: false,
    settings: {
      startDate: dateToTimestamp(dayjs().toDate()),
      endDate: dateToTimestamp(dayjs().add(1, 'w').toDate()),
      guardiansOnly: true,
      spaceUpdateData,
    },
    questions: [
      {
        text: 'Do you want to edit the space?',
        additionalInfo: getSpaceDiffInfo(prevSpace, spaceUpdateData),
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

const getSpaceDiffInfo = (prev: Space, change: Space) =>
  Object.entries(change).reduce((acc, [key, value]) => {
    if (key === 'uid' || value === null || value === get(prev, key)) {
      return acc;
    }
    return acc + `${startCase(key)}: ${value} (previously: ${get(prev, key, 'None')})\n`;
  }, 'Changes requested.<br />');
