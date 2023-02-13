import {
  Award,
  AwardBadgeType,
  COL,
  MediaStatus,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { joinSpace } from '../../src/controls/space/member.join.control';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { createAward, fundAward } from '../../src/runtime/firebase/award';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    mockWalletReturnValue(walletSpy, member, awardRequest(space.uid));
    award = await testEnv.wrap(createAward)({});
  });

  it('Should upload award media', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
    await wait(async () => {
      const award = <Award>(await awardDocRef.get()).data();
      return award.approved && award.funded;
    });

    await uploadMediaToWeb3();

    const awardData = <Award>(await awardDocRef.get()).data();
    expect(awardData.mediaStatus).toBe(MediaStatus.UPLOADED);
  });
});

const awardRequest = (space: string) => ({
  name: 'award',
  description: 'award',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badge',
    total: 2,
    image: MEDIA,
    type: AwardBadgeType.BASE,
    tokenReward: MIN_IOTA_AMOUNT,
    lockTime: 31557600000,
  },
  network,
});
