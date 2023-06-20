import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  Space,
  Token,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { processExpiredAwards } from '../../src/cron/award.cron';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import {
  approveAwardParticipant,
  awardParticipate,
  cancelAward,
  createAward,
  fundAward,
} from '../../src/runtime/firebase/award';
import { joinSpace } from '../../src/runtime/firebase/space';
import { claimMintedTokenOrder } from '../../src/runtime/firebase/token/minting';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { awaitAllTransactionsForAward, saveBaseToken } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let guardianAddress: AddressDetails;
  let walletService: SmrWallet;
  let token: Token;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = (await WalletService.newWallet(network)) as SmrWallet;
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    token = await saveBaseToken(space.uid, guardian);

    mockWalletReturnValue(walletSpy, guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it.each([false, true])(
    'Should create, fund and participate in award, cancel',
    async (shouldCancel: boolean) => {
      mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
      const order = await testEnv.wrap(fundAward)({});
      await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

      const awardDocRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
      await wait(async () => {
        const award = <Award>await awardDocRef.get();
        return award.approved && award.funded;
      });
      const awardData = <Award>await awardDocRef.get();
      expect(awardData.aliasBlockId).toBeDefined();
      expect(awardData.aliasId).toBeDefined();
      expect(awardData.collectionBlockId).toBeDefined();
      expect(awardData.collectionId).toBeDefined();

      mockWalletReturnValue(walletSpy, member, { uid: award.uid });
      await testEnv.wrap(awardParticipate)({});

      mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [member] });
      await testEnv.wrap(approveAwardParticipant)({});

      if (shouldCancel) {
        mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
        await testEnv.wrap(cancelAward)({});
      } else {
        await awardDocRef.update({ endDate: dateToTimestamp(dayjs().subtract(1, 'minute')) });
        await processExpiredAwards();
        await processExpiredAwards();
      }

      mockWalletReturnValue(walletSpy, member, { symbol: token.symbol });
      const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
      await requestFundsFromFaucet(
        network,
        claimOrder.payload.targetAddress,
        claimOrder.payload.amount,
      );

      const billPaymentQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', member)
        .where('type', '==', TransactionType.BILL_PAYMENT);
      await wait(async () => {
        const snap = await billPaymentQuery.get();
        return snap.length === 1;
      });

      const nttQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', member)
        .where('payload.type', '==', TransactionPayloadType.BADGE);
      await wait(async () => {
        const snap = await nttQuery.get();
        return snap.length === 1;
      });

      const creditQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', guardian)
        .where('type', '==', TransactionType.CREDIT);
      await wait(async () => {
        const snap = await creditQuery.get();
        return snap.length === 1;
      });

      const credit = <Transaction>(await creditQuery.get())[0];
      expect(credit.payload.token).toBe(token.uid);
      expect(credit.payload.tokenSymbol).toBe(token.symbol);
      expect(credit.payload.type).toBe(TransactionPayloadType.AWARD_COMPLETED);

      await awaitAllTransactionsForAward(award.uid);

      const burnAliasQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('payload.type', '==', TransactionPayloadType.BURN_ALIAS)
        .where('member', '==', guardian);
      await wait(async () => {
        const snap = await burnAliasQuery.get<Transaction>();
        return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
      });

      const balance = await walletService.getBalance(guardianAddress.bech32);
      expect(balance).toBe(award.aliasStorageDeposit + 2 * award.badge.tokenReward);
    },
  );
});

const awardRequest = (space: string, tokenSymbol: string) => ({
  name: 'award',
  description: 'award',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badge',
    total: 3,
    image: MEDIA,
    tokenReward: MIN_IOTA_AMOUNT,
    lockTime: 31557600000,
    tokenSymbol,
  },
  network,
});
