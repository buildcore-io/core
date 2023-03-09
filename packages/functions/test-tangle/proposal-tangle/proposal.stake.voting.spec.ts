import { COL, MIN_IOTA_AMOUNT, TangleRequestType, Transaction } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { approveProposal } from '../../src/runtime/firebase/proposal';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Create proposal via tangle request', () => {
  const helper = new Helper();
  let proposalUid = '';

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();

    proposalUid = await helper.sendCreateProposalRequest();

    mockWalletReturnValue(helper.walletSpy, helper.guardian, { uid: proposalUid });
    await testEnv.wrap(approveProposal)({});
  });

  it('Should create proposal and vote with staked tokens', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(3, 'd'));

    await helper.walletService.send(
      helper.guardianAddress,
      helper.tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.PROPOSAL_VOTE,
            uid: proposalUid,
            values: [1],
            voteWithStakedTokes: true,
          },
        },
      },
    );

    await wait(async () => {
      const snap = await helper.guardianCreditQuery.get();
      return snap.size === 2;
    });

    const snap = await helper.guardianCreditQuery.get();
    const credit = snap.docs
      .find((c) => !isEmpty(c.data()?.payload?.response?.voteTransaction))
      ?.data() as Transaction;
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);

    const voteTransactionDocRef = admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${credit.payload.response.voteTransaction}`);
    const voteTransaction = <Transaction>(await voteTransactionDocRef.get()).data();
    expect(+voteTransaction.payload.weight.toFixed(0)).toBe(150);

    await helper.assertProposalWeights(150, 150);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 150, 1);
  });
});
