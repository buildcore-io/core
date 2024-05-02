import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  Space,
  TangleRequestType,
  Token,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

describe('Award tangle request', () => {
  let guardian: string;
  let space: Space;
  let guardianAddress: AddressDetails;
  let walletService: Wallet;
  let token: Token;
  let tangleOrder: Transaction;

  beforeAll(async () => {});

  const beforeEach = async (network: Network) => {
    tangleOrder = await getTangleOrder(network);

    walletService = await getWallet(network);
    guardian = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = await saveBaseToken(space.uid, guardian, network);

    const guardianDocRef = build5Db().doc(COL.MEMBER, guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  };

  it.each([Network.RMS, Network.ATOI])(
    'Should create with tangle request',
    async (network: Network) => {
      await beforeEach(network);
      const newAward = awardRequest(space.uid, token.symbol, MEDIA, network);
      await requestFundsFromFaucet(network, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
      await walletService.send(
        guardianAddress,
        tangleOrder.payload.targetAddress!,
        5 * MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: TangleRequestType.AWARD_CREATE,
              ...newAward,
            },
          },
        },
      );

      const creditQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
        .where('member', '==', guardian);
      await wait(async () => {
        const snap = await creditQuery.get();
        return snap.length === 1;
      });
      const snap = await creditQuery.get();
      const credit = snap[0] as Transaction;
      expect(credit.payload.amount).toBe(5 * MIN_IOTA_AMOUNT);

      const awardDocRef = build5Db().doc(COL.AWARD, credit.payload.response!.award as string);
      const award = (await awardDocRef.get()) as Award;
      expect(award.uid).toBe(credit.payload.response!.award);
      expect(award.name).toBe(newAward.name);
      expect(award.description).toBe(newAward.description);
      expect(award.space).toBe(newAward.space);
      expect(award.endDate).toBeDefined();
      expect(award.network).toBe(newAward.network);
      expect(award.badge.name).toBe(newAward.badge.name);
      expect(award.badge.description).toBe(newAward.badge.description);
      expect(award.badge.total).toBe(newAward.badge.total);
      expect(award.badge.tokenReward).toBe(newAward.badge.tokenReward);
      expect(award.badge.lockTime).toBe(newAward.badge.lockTime);
      expect(award.badge.tokenUid).toBe(token.uid);
    },
  );
});

const awardRequest = (space: string, tokenSymbol: string, image: string, network: Network) => ({
  name: 'award',
  description: 'award',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badge',
    total: 2,
    image,
    tokenReward: MIN_IOTA_AMOUNT,
    lockTime: 31557600000,
    tokenSymbol,
  },
  network,
});
