import {
  COL,
  MIN_IOTA_AMOUNT,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build5/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { approveProposal } from '../../src/runtime/firebase/proposal';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper, MINTED_TOKEN_ID } from './Helper';

describe('Create proposal via tangle request', () => {
  const helper = new Helper();
  let proposalUid = '';

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    await helper.requestFunds();

    proposalUid = await helper.sendCreateProposalRequest();

    mockWalletReturnValue(helper.walletSpy, helper.guardian, { uid: proposalUid });
    await testEnv.wrap(approveProposal)({});
  });

  it('Should vote full, then 50%', async () => {
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
        nativeTokens: [{ amount: '0xa', id: MINTED_TOKEN_ID }],
      },
    );
    await MnemonicService.store(helper.guardianAddress.bech32, helper.guardianAddress.mnemonic);

    const orderQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.VOTE)
      .where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await orderQuery.get();
      return snap.length === 1;
    });

    const snap = await orderQuery.get<Transaction>();
    const voteTransaction = snap[0];

    await wait(async () => {
      const balance = await helper.walletService.getBalance(helper.guardianAddress.bech32);
      return balance === 6 * MIN_IOTA_AMOUNT;
    });

    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction.uid, dayjs().subtract(3, 'd'));
  });
});
