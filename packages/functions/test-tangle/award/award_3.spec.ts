import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  MediaStatus,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Token,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { createAward, fundAward } from '../../src/runtime/firebase/award';
import { joinSpace } from '../../src/runtime/firebase/space';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let token: Token;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    token = await saveBaseToken(space.uid, guardian, network);

    mockWalletReturnValue(walletSpy, guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});
  });

  it('Should upload award media', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
    await wait(async () => {
      const award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });

    await uploadMediaToWeb3();

    const awardData = <Award>await awardDocRef.get();
    expect(awardData.mediaStatus).toBe(MediaStatus.UPLOADED);
  });
});

const awardRequest = (space: string, tokenSymbol: string) => ({
  name: 'award',
  description: 'award',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badge',
    total: 2,
    image: MEDIA,
    tokenReward: MIN_IOTA_AMOUNT,
    lockTime: 31557600000,
    tokenSymbol,
  },
  network,
});
