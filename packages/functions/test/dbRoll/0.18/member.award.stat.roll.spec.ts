import { COL, Member, Network, Space, TokenStatus } from '@soonaverse/interfaces';
import { memberStatRoll } from '../../../scripts/dbUpgrades/0_18/member.stats.roll';
import admin from '../../../src/admin.config';
import { XP_TO_SHIMMER } from '../../../src/firebase/functions/dbRoll/award.roll';
import { xpTokenGuardianId, xpTokenId, xpTokenUid } from '../../../src/utils/config.utils';
import { serverTime } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { createMember, createSpace } from '../../controls/common';

let walletSpy: any;

describe('Collection discount roll', () => {
  let space: Space;
  let member: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, member);

    const xpToken = {
      symbol: 'XPT',
      approved: true,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: 'asd',
      uid: xpTokenUid(),
      createdBy: xpTokenGuardianId(),
      name: 'xptoken',
      status: TokenStatus.MINTED,
      access: 0,
      mintingData: {
        network: Network.RMS,
        tokenId: xpTokenId(),
      },
    };
    await admin.firestore().doc(`${COL.TOKEN}/${xpToken.uid}`).set(xpToken);
    return xpToken;
  });

  it('Should roll member award space stats', async () => {
    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
    await memberDocRef.update({
      awardsCompleted: 10,
      totalReputation: 100,
      spaces: {
        [space.uid]: {
          uid: space.uid,
          badges: ['badge1', 'badge2'],
          awardsCompleted: 10,
          totalReputation: 100,
        },
      },
    });

    await memberStatRoll(admin.app());

    const memberData = <Member>(await memberDocRef.get()).data();
    expect(memberData.awardsCompleted).toBe(10);
    expect(memberData.totalReward).toBe(100 * XP_TO_SHIMMER);

    expect(memberData.spaces![space.uid].awardsCompleted).toBe(10);
    expect(memberData.spaces![space.uid].totalReward).toBe(100 * XP_TO_SHIMMER);

    const awardStats = memberData.spaces![space.uid].awardStat![xpTokenUid()];
    expect(awardStats.tokenSymbol).toBe('XPT');
    expect(awardStats.badges).toEqual(['badge1', 'badge2']);
    expect(awardStats.completed).toBe(10);
    expect(awardStats.totalReward).toBe(100 * XP_TO_SHIMMER);
  });
});
