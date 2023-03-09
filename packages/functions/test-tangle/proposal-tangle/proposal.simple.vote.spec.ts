import {
  COL,
  MIN_IOTA_AMOUNT,
  Proposal,
  ProposalType,
  TangleRequestType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { approveProposal } from '../../src/runtime/firebase/proposal';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Create proposal via tangle request', () => {
  const helper = new Helper(ProposalType.MEMBERS);

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create proposal and vote', async () => {
    const proposalUid = await helper.sendCreateProposalRequest();

    mockWalletReturnValue(helper.walletSpy, helper.guardian, { uid: proposalUid });
    await testEnv.wrap(approveProposal)({});

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
          },
        },
      },
    );
    await MnemonicService.store(helper.guardianAddress.bech32, helper.guardianAddress.mnemonic);
    await wait(async () => {
      const snap = await helper.guardianCreditQuery.get();
      return snap.size === 2;
    });

    let proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposalUid}`);
    let proposal = <Proposal>(await proposalDocRef.get()).data();
    expect(proposal.results.answers[1]).toBe(1);

    await helper.walletService.send(
      helper.guardianAddress,
      helper.tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.PROPOSAL_VOTE,
            uid: proposalUid,
            values: [2],
          },
        },
      },
    );
    await MnemonicService.store(helper.guardianAddress.bech32, helper.guardianAddress.mnemonic);
    await wait(async () => {
      const snap = await helper.guardianCreditQuery.get();
      return snap.size === 3;
    });

    proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposalUid}`);
    proposal = <Proposal>(await proposalDocRef.get()).data();
    expect(proposal.results.answers[2]).toBe(1);
    expect(proposal.results.answers[1]).toBe(0);
  });
});
