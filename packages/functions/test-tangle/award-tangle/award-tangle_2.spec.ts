import { database } from '@buildcore/database';
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
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
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

  const beforeEach = async (network: Network) => {
    tangleOrder = await getTangleOrder(network);

    walletService = await getWallet(network);
    guardian = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = await saveBaseToken(space.uid, guardian, network);

    const guardianDocRef = database().doc(COL.MEMBER, guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  };

  it.each([Network.RMS, Network.ATOI])(
    'Should create and fund award with tangle request after create',
    async (network: Network) => {
      await beforeEach(network);
      const newAward = awardRequest(space.uid, token.symbol, network);
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

      const creditQuery = database()
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

      await requestFundsFromFaucet(
        Network.RMS,
        credit.payload.response!.address as string,
        credit.payload.response!.amount as number,
      );

      const awardDocRef = database().doc(COL.AWARD, credit.payload.response!.award! as string);
      await wait(async () => {
        const award = (await awardDocRef.get()) as Award;
        return award.funded;
      });
    },
  );

  it('Should create and fund award with new tangle request', async () => {
    await beforeEach(Network.RMS);
    const newAward = awardRequest(space.uid, token.symbol, Network.RMS);
    await requestFundsFromFaucet(Network.RMS, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.AWARD_CREATE,
          ...newAward,
        },
      },
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });
    let snap = await creditQuery.get();
    let credit = snap[0] as Transaction;
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);
    const awardDocRef = database().doc(COL.AWARD, credit.payload.response!.award as string);

    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.AWARD_FUND,
          uid: credit.payload.response!.award,
        },
      },
    });
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 2;
    });
    snap = await creditQuery.get();
    credit = snap.find((doc) => doc?.payload?.response?.award === undefined)!;
    await requestFundsFromFaucet(
      Network.RMS,
      credit.payload.response!.address as string,
      credit.payload.response!.amount as number,
    );

    await wait(async () => {
      const award = (await awardDocRef.get()) as Award;
      return award.funded;
    });
  });
});

const awardRequest = (space: string, tokenSymbol: string, network: Network) => ({
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
