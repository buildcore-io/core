import { MIN_IOTA_AMOUNT, Network, Token, WEN_FUNC, WenError } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { expectThrow } from '../../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { saveBaseToken } from './common';

describe('Create award, base', () => {
  let token: Token;

  it('Should throw, max lockTime', async () => {
    const network = Network.RMS;
    const guardian = await testEnv.createMember();
    const space = await testEnv.createSpace(guardian);
    token = await saveBaseToken(space.uid, guardian, network);
    mockWalletReturnValue(guardian, awardRequest(network, space.uid, token.symbol));
    await expectThrow(testEnv.wrap(WEN_FUNC.createAward), WenError.invalid_params.key);
  });
});

const awardRequest = (network: Network, space: string, tokenSymbol: string) => ({
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
    lockTime: (Math.pow(2, 32) - dayjs().unix() + 1000) * 1000,
    tokenSymbol,
  },
  network,
});
