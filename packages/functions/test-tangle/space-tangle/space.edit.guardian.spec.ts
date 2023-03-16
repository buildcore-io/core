import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Proposal,
  ProposalType,
  TangleRequestType,
  Transaction,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { joinSpace } from '../../src/runtime/firebase/space';
import { addGuardianToSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Edit guardian space', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([TangleRequestType.SPACE_ADD_GUARDIAN, TangleRequestType.SPACE_REMOVE_GUARDIAN])(
    'Should add/remove guardian',
    async (requestType: TangleRequestType) => {
      mockWalletReturnValue(helper.walletSpy, helper.member, { uid: helper.space.uid });
      await testEnv.wrap(joinSpace)({});

      if (requestType === TangleRequestType.SPACE_REMOVE_GUARDIAN) {
        await addGuardianToSpace(helper.space.uid, helper.member);
      }

      await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, MIN_IOTA_AMOUNT);
      await helper.walletService.send(
        helper.guardianAddress,
        helper.tangleOrder.payload.targetAddress,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType,
              uid: helper.space.uid,
              member: helper.member,
            },
          },
        },
      );

      await wait(async () => {
        const snap = await helper.guardianCreditQuery.get();
        return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
      });
      const snap = await helper.guardianCreditQuery.get();
      const credit = snap.docs[0].data() as Transaction;
      const proposalId = credit.payload.response.proposal;

      const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposalId}`);
      const proposal = <Proposal>(await proposalDocRef.get()).data();
      expect(proposal.type).toBe(
        requestType === TangleRequestType.SPACE_ADD_GUARDIAN
          ? ProposalType.ADD_GUARDIAN
          : ProposalType.REMOVE_GUARDIAN,
      );
    },
  );
});
