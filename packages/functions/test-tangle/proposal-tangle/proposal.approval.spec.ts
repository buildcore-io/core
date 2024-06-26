import { database } from '@buildcore/database';
import { COL, MIN_IOTA_AMOUNT, Proposal, TangleRequestType } from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Proposal approval via tangle request', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([true, false])(
    'Should create&approve proposal with tangle request',
    async (approve: boolean) => {
      const proposalUid = await helper.sendCreateProposalRequest();

      expect(proposalUid).toBeDefined();

      await helper.walletService.send(
        helper.guardianAddress,
        helper.tangleOrder.payload.targetAddress!,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: approve
                ? TangleRequestType.PROPOSAL_APPROVE
                : TangleRequestType.PROPOSAL_REJECT,
              uid: proposalUid,
            },
          },
        },
      );
      await wait(async () => {
        const snap = await helper.guardianCreditQuery.get();
        return snap.length === 2;
      });

      const proposalDocRef = database().doc(COL.PROPOSAL, proposalUid);
      const proposal = <Proposal>await proposalDocRef.get();

      expect(approve ? proposal.approved : proposal.rejected).toBe(true);
      expect(approve ? proposal.approvedBy : proposal.rejectedBy).toBe(helper.guardian);
    },
  );
});
