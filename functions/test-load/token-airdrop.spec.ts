import dayjs from 'dayjs';
import { Member, Space } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
import { Token, TokenAllocation } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { airdropToken, claimAirdroppedToken, createToken } from '../src/controls/token.control';
import * as wallet from '../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
} from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { createMemberCopies } from './common';

let walletSpy: any;
const membersCount = 8000;

const dummyToken = (space: string) =>
  ({
    name: 'MyToken',
    symbol: getRandomSymbol(),
    space,
    pricePerToken: 1 * 1000 * 1000,
    totalSupply: 10 * 1000,
    allocations: <TokenAllocation[]>[{ title: 'Allocation1', percentage: 100 }],
    icon: 'icon',
    overviewGraphics: 'overviewGraphics',
    termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
    access: 0,
  } as any);

describe('Token airdrop test', () => {
  let members: string[];
  let guardian: string;
  let space: Space;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);
    const guardianDoc = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${guardian}`).get()).data()
    );
    members = await createMemberCopies(guardianDoc, membersCount);

    const dummyTokenData = dummyToken(space.uid);
    mockWalletReturnValue(walletSpy, guardian, dummyTokenData);
    token = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });
    console.log('TOKENID', token.uid);
  });

  it('Should airdrop token', async () => {
    const vestingAt = dayjs().subtract(1, 's').toDate();
    for (let i = 0; i < membersCount / 400; ++i) {
      const drops: any = [];
      for (let j = 0; j < 400; ++j) {
        drops.push({ count: 1, recipient: members[i * 400 + j], vestingAt });
      }
      mockWalletReturnValue(walletSpy, guardian, { token: token.uid, drops });
      await testEnv.wrap(airdropToken)({});
    }

    const tokenData = <Token>(
      (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    );
    expect(tokenData.totalAirdropped).toBe(members.length);

    const claimPromises = members.map(async (member) => {
      mockWalletReturnValue(walletSpy, member, { token: token.uid });
      const order = await testEnv.wrap(claimAirdroppedToken)({});
      const nextMilestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        order.payload.amount,
      );
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
    });

    await Promise.all(claimPromises);

    const totalOwned = (
      await admin.firestore().collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`).get()
    ).docs.reduce((sum, doc) => sum + doc.data()!.tokenOwned, 0);
    expect(totalOwned).toBe(members.length);
  });
});
