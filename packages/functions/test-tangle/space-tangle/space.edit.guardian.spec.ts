import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Proposal,
  ProposalType,
  TangleRequestType,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { addGuardianToSpace, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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
      mockWalletReturnValue(helper.member, { uid: helper.space.uid });
      await testEnv.wrap(WEN_FUNC.joinSpace);

      if (requestType === TangleRequestType.SPACE_REMOVE_GUARDIAN) {
        await addGuardianToSpace(helper.space.uid, helper.member);
      }

      await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, MIN_IOTA_AMOUNT);
      await helper.walletService.send(
        helper.guardianAddress,
        helper.tangleOrder.payload.targetAddress!,
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
        return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
      });
      const snap = await helper.guardianCreditQuery.get();
      const credit = snap[0] as Transaction;
      const proposalId = credit.payload.response!.proposal as string;

      const proposalDocRef = database().doc(COL.PROPOSAL, proposalId);
      const proposal = <Proposal>await proposalDocRef.get();
      expect(proposal.type).toBe(
        requestType === TangleRequestType.SPACE_ADD_GUARDIAN
          ? ProposalType.ADD_GUARDIAN
          : ProposalType.REMOVE_GUARDIAN,
      );
    },
  );
});
