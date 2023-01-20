import {
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  MAX_MILLISECONDS,
  MAX_TOTAL_TOKEN_SUPPLY,
  MAX_WEEKS_TO_STAKE,
  Member,
  MIN_WEEKS_TO_STAKE,
  Proposal,
  ProposalSubType,
  ProposalType,
  REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE,
  StakeReward,
  StakeRewardStatus,
  StakeType,
  SUB_COL,
  Timestamp,
  Token,
  Transaction,
  TransactionType,
  URL_PATHS,
  VoteTransaction,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { uniq } from 'lodash';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { createStakeOrder } from '../services/payment/tangle-service/stake.service';
import { cOn, dateToTimestamp } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { assertIsGuardian } from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

export const depositStakeSchema = {
  symbol: CommonJoi.tokenSymbol(),
  weeks: Joi.number().integer().min(MIN_WEEKS_TO_STAKE).max(MAX_WEEKS_TO_STAKE).required(),
  type: Joi.string()
    .equal(...Object.values(StakeType))
    .required(),
  customMetadata: Joi.object()
    .max(5)
    .pattern(Joi.string().max(50), Joi.string().max(255))
    .optional(),
};

export const depositStake = functions
  .runWith({
    minInstances: scale(WEN_FUNC.depositStake),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req, WEN_FUNC.tradeToken);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(depositStakeSchema);
    await assertValidationAsync(schema, params.body);

    const order = await createStakeOrder(
      owner,
      params.body.symbol,
      params.body.weeks,
      params.body.type,
      params.body.customMetadata,
    );
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
    return order;
  });

interface StakeRewardItem {
  readonly startDate: number;
  readonly endDate: number;
  readonly tokenVestingDate: number;
  readonly tokensToDistribute: number;
}

const stakeRewardSchema = {
  token: CommonJoi.uid(),
  items: Joi.array()
    .min(1)
    .max(500)
    .items(
      Joi.object({
        startDate: Joi.number().min(0).max(MAX_MILLISECONDS).integer().required(),
        endDate: Joi.number()
          .min(0)
          .max(MAX_MILLISECONDS)
          .greater(Joi.ref('startDate'))
          .integer()
          .required(),
        tokenVestingDate: Joi.number()
          .min(0)
          .max(MAX_MILLISECONDS)
          .greater(Joi.ref('endDate'))
          .integer()
          .required(),
        tokensToDistribute: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).required(),
      }),
    ),
};

export const stakeReward = functions
  .runWith({
    minInstances: scale(WEN_FUNC.stakeReward),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.stakeReward, context);
    const params = await decodeAuth(req, WEN_FUNC.stakeReward);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(stakeRewardSchema);
    await assertValidationAsync(schema, params.body);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
    const token = <Token | undefined>(await tokenDocRef.get()).data();
    if (!token) {
      throw throwInvalidArgument(WenError.token_does_not_exist);
    }
    await assertIsGuardian(token.space, owner);

    const stakeRewards = (params.body.items as StakeRewardItem[]).map<StakeReward>((item) => ({
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs(item.startDate).toDate()),
      endDate: dateToTimestamp(dayjs(item.endDate).toDate()),
      tokenVestingDate: dateToTimestamp(dayjs(item.tokenVestingDate).toDate()),
      tokensToDistribute: item.tokensToDistribute,
      token: params.body.token,
      status: StakeRewardStatus.UNPROCESSED,
      leftCheck: dayjs(item.startDate).valueOf(),
      rightCheck: dayjs(item.endDate).valueOf(),
    }));

    const batch = admin.firestore().batch();
    stakeRewards.forEach((stakeReward) => {
      const docRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
      batch.create(docRef, cOn(stakeReward));
    });
    await batch.commit();

    return stakeRewards;
  });

const removeStakeRewardSchema = {
  stakeRewardIds: Joi.array().items(CommonJoi.uid()).min(1).max(450).required(),
};

export const removeStakeReward = functions
  .runWith({
    minInstances: scale(WEN_FUNC.removeStakeReward),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.removeStakeReward, context);
    const params = await decodeAuth(req, WEN_FUNC.removeStakeReward);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(removeStakeRewardSchema);
    await assertValidationAsync(schema, params.body);

    const stakeRewardIds = params.body.stakeRewardIds as string[];
    const stakeRewardPromises = stakeRewardIds.map(async (stakeId) => {
      const docRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeId}`);
      return <StakeReward | undefined>(await docRef.get()).data();
    });
    const stakeRewards = await Promise.all(stakeRewardPromises);
    stakeRewards.sort((a, b) => a!.startDate.seconds - b!.startDate.seconds);

    if (stakeRewards.find((reward) => reward === undefined)) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    const tokenIds = uniq(stakeRewards.map((reward) => reward!.token));
    if (tokenIds.length > 1) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${tokenIds[0]}`);
    const token = <Token>(await tokenDocRef.get()).data();

    await assertIsGuardian(token.space, owner);

    const ongoingProposalSnap = await admin
      .firestore()
      .collection(COL.PROPOSAL)
      .where('space', '==', token.space)
      .where('settings.endDate', '>=', dateToTimestamp(dayjs()))
      .get();
    if (ongoingProposalSnap.size) {
      throw throwInvalidArgument(WenError.ongoing_proposal);
    }

    const guardian = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data();
    const guardians = await admin
      .firestore()
      .collection(`${COL.SPACE}/${token.space}/${SUB_COL.GUARDIANS}`)
      .get();
    const proposal = createUpdateSpaceProposal(
      guardian,
      token.space,
      guardians.size,
      stakeRewards as StakeReward[],
      stakeRewards[0]!.startDate,
    );

    const voteTransaction = <Transaction>{
      type: TransactionType.VOTE,
      uid: getRandomEthAddress(),
      member: owner,
      space: token.space,
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
  owner: Member,
  space: string,
  guardiansCount: number,
  stakeRewards: StakeReward[],
  endDate: Timestamp,
) => {
  const additionalInfo =
    `${owner.name} wants to remove stake rewards. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}.` +
    `${REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE} % must agree for this action to proceed <br /><br />`;
  return <Proposal>{
    createdBy: owner.uid,
    uid: getRandomEthAddress(),
    name: 'Remove stake rewards',
    additionalInfo: additionalInfo + getDescription(stakeRewards),
    space,
    type: ProposalType.REMOVE_STAKE_REWARD,
    subType: ProposalSubType.ONE_MEMBER_ONE_VOTE,
    approved: true,
    rejected: false,
    settings: {
      startDate: dateToTimestamp(dayjs().toDate()),
      endDate,
      guardiansOnly: true,
      stakeRewardIds: stakeRewards.map((stakeReward) => stakeReward.uid),
    },
    questions: [
      {
        text: 'Do you want to remove stake rewards?',
        additionalInfo: '',
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

const getDescription = (stakeRewards: StakeReward[]) => {
  const description =
    `| Start Date | End Date | Token Vesting Date | Tokens To Distribute |<br />` +
    '| --- | --- | --- | --- |<br />';
  const rewardsInfo = stakeRewards.map(stakeRewardToInfo).join('<br />');
  return description + rewardsInfo;
};

const stakeRewardToInfo = (stakeReward: StakeReward) =>
  `| ${dayjs(stakeReward.startDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
  `| ${dayjs(stakeReward.endDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
  `| ${dayjs(stakeReward.tokenVestingDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
  `| ${stakeReward.tokensToDistribute} |`;
