import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  SUB_COL,
  Space,
  Token,
  TokenDistribution,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import { NftOutput, TimelockUnlockCondition, UnlockConditionType } from '@iota/sdk';
import dayjs from 'dayjs';
import { Wallet } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { awaitAllTransactionsForAward, saveBaseToken } from './common';

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let walletService: Wallet;
  let now: dayjs.Dayjs;
  let token: Token;

  const setup = async (network: Network) => {
    now = dayjs();
    walletService = await getWallet(network);
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = await saveBaseToken(space.uid, guardian, network);

    mockWalletReturnValue(guardian, awardRequest(network, space.uid, token.symbol));
    award = await testEnv.wrap(WEN_FUNC.createAward);
  };

  it.each([Network.ATOI, Network.RMS])(
    'Should create, fund and participate in award',
    async (network: Network) => {
      await setup(network);
      mockWalletReturnValue(guardian, { uid: award.uid });
      const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);

      const address = await walletService.getNewIotaAddressDetails();
      await requestFundsFromFaucet(network, address.bech32, order.payload.amount!);
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

      mockWalletReturnValue(guardian, { award: award.uid, members: [member, member] });
      await testEnv.wrap(WEN_FUNC.approveParticipantAward);

      const memberDocRef = build5Db().doc(COL.MEMBER, member);
      const memberData = <Member>await memberDocRef.get();
      const memberBech32 = getAddress(memberData, network);

      const distributionDocRef = build5Db().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member);
      let distribution = await distributionDocRef.get();
      expect(distribution?.totalUnclaimedAirdrop).toBe(2 * MIN_IOTA_AMOUNT);

      const nttQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', member)
        .where('payload_type', '==', TransactionPayloadType.BADGE);
      await wait(async () => {
        const snap = await nttQuery.get();
        return snap.length === 2;
      });

      mockWalletReturnValue(member, { symbol: token.symbol });
      const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
      await requestFundsFromFaucet(
        network,
        claimOrder.payload.targetAddress!,
        claimOrder.payload.amount!,
      );

      const billPaymentQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', member)
        .where('type', '==', TransactionType.BILL_PAYMENT);
      await wait(async () => {
        const snap = await billPaymentQuery.get();
        return snap.length === 2;
      });

      await awaitAllTransactionsForAward(award.uid);

      distribution = <TokenDistribution>await distributionDocRef.get();
      expect(distribution.totalUnclaimedAirdrop).toBe(0);

      await wait(async () => {
        let { amount } = await walletService.getBalance(memberBech32);
        return amount === 2 * MIN_IOTA_AMOUNT + claimOrder.payload.amount!;
      });

      await wait(async () => {
        const response = await walletService.client.nftOutputIds([{ address: memberBech32 }]);
        return response.items.length === 2;
      });

      const response = await walletService.client.nftOutputIds([{ address: memberBech32 }]);
      const promises = response.items.map(
        async (outputId) => (await walletService.client.getOutput(outputId)).output as NftOutput,
      );
      const outputs = await Promise.all(promises);
      for (const nttOutput of outputs) {
        const timelock = nttOutput.unlockConditions.find(
          (uc) => uc.type === UnlockConditionType.Timelock,
        ) as TimelockUnlockCondition;
        expect(dayjs.unix(timelock.unixTime).isAfter(now.add(50 * 31557600000))).toBe(true);
      }

      const burnAliasQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('payload_type', '==', TransactionPayloadType.BURN_ALIAS)
        .where('member', '==', guardian);
      await wait(async () => {
        const snap = await burnAliasQuery.get();
        return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
      });

      await wait(async () => {
        const { amount } = await walletService.getBalance(address.bech32);
        return amount === award.aliasStorageDeposit;
      });
    },
  );
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
    lockTime: 50 * 31557600000,
    tokenSymbol,
  },
  network,
});
