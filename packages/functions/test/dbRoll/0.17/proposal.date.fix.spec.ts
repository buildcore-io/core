import { COL, Proposal } from '@soonaverse/interfaces';
import { proposalDateFixes } from '../../../scripts/dbUpgrades/0_17/proposal.date.fix';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Proposal date fix', () => {
  it('Fix proposal date', async () => {
    const proposalId = getRandomEthAddress();
    const propDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposalId}`);
    await propDocRef.create({
      settings: {
        startDate: '2023-02-05T22:55:43.301Z',
        endDate: '2023-02-05T22:55:43.301Z',
      },
    });

    await proposalDateFixes(admin.app());

    const proposal = <Proposal>(await propDocRef.get()).data();
    expect(proposal.settings.startDate.seconds).toBe(1675637743);
    expect(proposal.settings.endDate.seconds).toBe(1675637743);
  });
});
