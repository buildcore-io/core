import {
  Award,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  Transaction,
  TransactionAwardType,
  TransactionType,
} from '@build5/interfaces';
import {
  IndexerPluginClient,
  INftOutput,
  ITimelockUnlockCondition,
  TIMELOCK_UNLOCK_CONDITION_TYPE,
} from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { soonDb } from '../../src/firebase/firestore/soondb';
import {
  approveAwardParticipant,
  awardParticipate,
  createAward,
  fundAward,
} from '../../src/runtime/firebase/award';
import { claimMintedTokenOrder } from '../../src/runtime/firebase/token/minting';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
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
  let now: dayjs.Dayjs;
  let token: Token;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = (await WalletService.newWallet(network)) as SmrWallet;
  });

  beforeEach(async () => {
    now = dayjs();
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    token = await saveBaseToken(space.uid, guardian);

    mockWalletReturnValue(walletSpy, guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});

    const guardianDocRef = soonDb().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create, fund and participate in award', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = soonDb().doc(`${COL.AWARD}/${award.uid}`);
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

    mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [member, member] });
    await testEnv.wrap(approveAwardParticipant)({});

    const memberDocRef = soonDb().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, network);

    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${token.uid}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
    let distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalUnclaimedAirdrop).toBe(2 * MIN_IOTA_AMOUNT);

    const nttQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionAwardType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 2;
    });

    mockWalletReturnValue(walletSpy, member, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const billPaymentQuery = soonDb()
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
      let balance = await walletService.getBalance(memberBech32);
      return balance === 2 * MIN_IOTA_AMOUNT + claimOrder.payload.amount;
    });

    const indexer = new IndexerPluginClient(walletService.client);

    await wait(async () => {
      const response = await indexer.nfts({ addressBech32: memberBech32 });
      return response.items.length === 2;
    });

    const response = await indexer.nfts({ addressBech32: memberBech32 });
    const promises = response.items.map(
      async (outputId) => (await walletService.client.output(outputId)).output as INftOutput,
    );
    const outputs = await Promise.all(promises);
    for (const nttOutput of outputs) {
      const timelock = nttOutput.unlockConditions.find(
        (uc) => uc.type === TIMELOCK_UNLOCK_CONDITION_TYPE,
      ) as ITimelockUnlockCondition;
      expect(dayjs.unix(timelock.unixTime).isAfter(now.add(31557600000))).toBe(true);
    }

    const burnAliasQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionAwardType.BURN_ALIAS)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await burnAliasQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    await wait(async () => {
      const balance = await walletService.getBalance(guardianAddress.bech32);
      return balance === award.aliasStorageDeposit;
    });
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
