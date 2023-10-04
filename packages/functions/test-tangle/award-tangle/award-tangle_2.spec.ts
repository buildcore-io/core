import {
  Award,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Token,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, wait } from '../../test/controls/common';
import { MEDIA } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

let walletSpy: any;

describe('Award tangle request', () => {
  let guardian: string;
  let space: Space;
  let guardianAddress: AddressDetails;
  let walletService: Wallet;
  let token: Token;
  let tangleOrder: Transaction;

  const beforeEach = async (network: Network) => {
    tangleOrder = await getTangleOrder(network);

    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = await WalletService.newWallet(network);
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    token = await saveBaseToken(space.uid, guardian, network);

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${guardian}`);
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

      await requestFundsFromFaucet(
        Network.RMS,
        credit.payload.response!.address as string,
        credit.payload.response!.amount as number,
      );

      const awardDocRef = build5Db().doc(`${COL.AWARD}/${credit.payload.response!.award}`);
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

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });
    let snap = await creditQuery.get<Transaction>();
    let credit = snap[0] as Transaction;
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);
    const awardDocRef = build5Db().doc(`${COL.AWARD}/${credit.payload.response!.award}`);

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
    snap = await creditQuery.get<Transaction>();
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
