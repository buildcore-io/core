import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Token,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { processExpiredAwards } from '../../src/cron/award.cron';
import { Wallet } from '../../src/services/wallet/wallet';
import { wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { awaitAllTransactionsForAward, saveBaseToken } from './common';

const network = Network.RMS;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let walletService: Wallet;
  let token: Token;

  beforeAll(async () => {
    walletService = await getWallet(network);
  });

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

  it.each([false, true])(
    'Should create, fund and participate in award, cancel',
    async (shouldCancel: boolean) => {
      mockWalletReturnValue(guardian, { uid: award.uid });
      const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);

      const address = await walletService.getNewIotaAddressDetails();
      await requestFundsFromFaucet(network, address.bech32, order.payload.amount);
      await walletService.send(address, order.payload.targetAddress!, order.payload.amount!, {});

      const awardDocRef = build5Db().doc(COL.AWARD, award.uid);
      await wait(async () => {
        const award = <Award>await awardDocRef.get();
        return award.approved && award.funded;
      });
      const awardData = <Award>await awardDocRef.get();
      expect(awardData.aliasBlockId).toBeDefined();
      expect(awardData.aliasId).toBeDefined();
      expect(awardData.collectionBlockId).toBeDefined();
      expect(awardData.collectionId).toBeDefined();

      mockWalletReturnValue(member, { uid: award.uid });
      await testEnv.wrap(WEN_FUNC.participateAward);

      mockWalletReturnValue(guardian, { award: award.uid, members: [member] });
      await testEnv.wrap(WEN_FUNC.approveParticipantAward);

      if (shouldCancel) {
        mockWalletReturnValue(guardian, { uid: award.uid });
        await testEnv.wrap(WEN_FUNC.cancelAward);
      } else {
        await awardDocRef.update({ endDate: dayjs().subtract(1, 'minute').toDate() });
        await processExpiredAwards();
        await processExpiredAwards();
      }

      mockWalletReturnValue(member, { symbol: token.symbol });
      const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
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
        .where('payload_type', '==', TransactionPayloadType.BADGE);
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
        .where('payload_type', '==', TransactionPayloadType.BURN_ALIAS)
        .where('member', '==', guardian);
      await wait(async () => {
        const snap = await burnAliasQuery.get();
        return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
      });

      const { amount } = await walletService.getBalance(address.bech32);
      expect(amount).toBe(award.aliasStorageDeposit + 2 * award.badge.tokenReward);
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
