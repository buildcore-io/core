import { database } from '@buildcore/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  MediaStatus,
  Network,
  Space,
  Token,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { wait } from '../../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let token: Token;

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    mockWalletReturnValue(member, { uid: space?.uid });
    await testEnv.wrap(WEN_FUNC.joinSpace);

    token = await saveBaseToken(space.uid, guardian, network);

    mockWalletReturnValue(guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(WEN_FUNC.createAward);
  });

  it('Should upload award media', async () => {
    mockWalletReturnValue(guardian, { uid: award.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = database().doc(COL.AWARD, award.uid);
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
