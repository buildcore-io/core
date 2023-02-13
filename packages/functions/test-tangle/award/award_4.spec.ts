import {
  Award,
  AwardBadgeType,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TransactionAwardType,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { joinSpace } from '../../src/controls/space/member.join.control';
import { processExpiredAwards } from '../../src/cron/award.cron';
import {
  approveAwardParticipant,
  awardParticipate,
  cancelAward,
  createAward,
  fundAward,
} from '../../src/runtime/firebase/award';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp, uOn } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { awaitAllTransactionsForAward } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let guardianAddress: AddressDetails;
  let walletService: SmrWallet;

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

    mockWalletReturnValue(walletSpy, member, awardRequest(space.uid));
    award = await testEnv.wrap(createAward)({});

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it.each([false, true])(
    'Should create, fund and participate in award, cancel',
    async (shouldCancel: boolean) => {
      mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
      const order = await testEnv.wrap(fundAward)({});
      await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

      const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
      await wait(async () => {
        const award = <Award>(await awardDocRef.get()).data();
        return award.approved && award.funded;
      });
      const awardData = <Award>(await awardDocRef.get()).data();
      expect(awardData.aliasBlockId).toBeDefined();
      expect(awardData.aliasId).toBeDefined();
      expect(awardData.collectionBlockId).toBeDefined();
      expect(awardData.collectionId).toBeDefined();

      mockWalletReturnValue(walletSpy, member, { uid: award.uid });
      await testEnv.wrap(awardParticipate)({});

      mockWalletReturnValue(walletSpy, guardian, { uid: award.uid, member });
      await testEnv.wrap(approveAwardParticipant)({});

      if (shouldCancel) {
        mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
        await testEnv.wrap(cancelAward)({});
      } else {
        await awardDocRef.update(uOn({ endDate: dateToTimestamp(dayjs().subtract(1, 'minute')) }));
        await processExpiredAwards();
        await processExpiredAwards();
      }

      const billPaymentQuery = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', member)
        .where('type', '==', TransactionType.BILL_PAYMENT);
      await wait(async () => {
        const snap = await billPaymentQuery.get();
        return snap.size === 1;
      });

      const nttQuery = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', member)
        .where('payload.type', '==', TransactionAwardType.BADGE);
      await wait(async () => {
        const snap = await nttQuery.get();
        return snap.size === 1;
      });

      const creditQuery = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', guardian)
        .where('type', '==', TransactionType.CREDIT);
      await wait(async () => {
        const snap = await creditQuery.get();
        return snap.size === 1;
      });

      await awaitAllTransactionsForAward(award.uid);

      const burnAliasQuery = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('payload.type', '==', TransactionAwardType.BURN_ALIAS)
        .where('member', '==', guardian);
      await wait(async () => {
        const snap = await burnAliasQuery.get();
        return snap.size === 1 && snap.docs[0]?.data()?.payload?.walletReference?.confirmed;
      });

      const balance = await walletService.getBalance(guardianAddress.bech32);
      expect(balance).toBe(award.aliasStorageDeposit + 2 * award.badge.tokenReward);
    },
  );
});

const awardRequest = (space: string) => ({
  name: 'award',
  description: 'award',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badge',
    total: 3,
    image: MEDIA,
    type: AwardBadgeType.BASE,
    tokenReward: MIN_IOTA_AMOUNT,
    lockTime: 31557600000,
  },
  network,
});
