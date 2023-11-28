import { MIN_IOTA_AMOUNT, Network, Token, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { createAward } from '../../src/runtime/firebase/award';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  expectThrow,
  mockWalletReturnValue,
} from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { saveBaseToken } from './common';

let walletSpy: any;

describe('Create award, base', () => {
  let token: Token;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  it('Should throw, max lockTime', async () => {
    const network = Network.RMS;
    const guardian = await createMember(walletSpy);
    const space = await createSpace(walletSpy, guardian);
    token = await saveBaseToken(space.uid, guardian, network);
    mockWalletReturnValue(walletSpy, guardian, awardRequest(network, space.uid, token.symbol));
    await expectThrow(testEnv.wrap(createAward)({}), WenError.invalid_params.key);
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
    lockTime: (Math.pow(2, 32) - dayjs().unix() + 100) * 1000,
    tokenSymbol,
  },
  network,
});
