import { build5App, build5Db } from '@build-5/database';
import { COL, Proposal, SOON_PROJECT_ID } from '@build-5/interfaces';
import { proposalRoll } from '../../scripts/dbUpgrades/1.0.0/proposal.roll';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Proposal roll test', () => {
  it('Should roll proposals', async () => {
    const proposals = [
      { uid: getRandomEthAddress(), completed: false },
      { uid: getRandomEthAddress(), completed: true },
      { uid: getRandomEthAddress() },
    ];

    for (const p of proposals) {
      const docRef = build5Db().doc(`${COL.PROPOSAL}/${p.uid}`);
      await docRef.create({ project: SOON_PROJECT_ID, ...p });
    }

    await proposalRoll(build5App);

    let docRef = build5Db().doc(`${COL.PROPOSAL}/${proposals[0].uid}`);
    let proposal = await docRef.get<Proposal>();
    expect(proposal?.completed).toBe(false);

    docRef = build5Db().doc(`${COL.PROPOSAL}/${proposals[1].uid}`);
    proposal = await docRef.get<Proposal>();
    expect(proposal?.completed).toBe(true);

    docRef = build5Db().doc(`${COL.PROPOSAL}/${proposals[2].uid}`);
    proposal = await docRef.get<Proposal>();
    expect(proposal?.completed).toBe(false);
  });
});
