import {
  IndexerPluginClient,
  INftOutput,
  ITimelockUnlockCondition,
  TIMELOCK_UNLOCK_CONDITION_TYPE,
} from '@iota/iota.js-next';
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
  TransactionAwardType,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import {
  approveAwardParticipant,
  awardParticipate,
  createAward,
  fundAward,
} from '../../src/runtime/firebase/award';
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

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create, fund and participate in award', async () => {
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

    mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [member, member] });
    await testEnv.wrap(approveAwardParticipant)({});

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>(await memberDocRef.get()).data();
    const memberBech32 = getAddress(memberData, network);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
    let distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.totalUnclaimedAirdrop).toBe(2 * MIN_IOTA_AMOUNT);

    const nttQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionAwardType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.size === 2;
    });

    mockWalletReturnValue(walletSpy, member, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const billPaymentQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    await wait(async () => {
      const snap = await billPaymentQuery.get();
      return snap.size === 2;
    });

    await awaitAllTransactionsForAward(award.uid);

    distribution = <TokenDistribution>(await distributionDocRef.get()).data();
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

    const burnAliasQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionAwardType.BURN_ALIAS)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await burnAliasQuery.get();
      return snap.size === 1 && snap.docs[0]?.data()?.payload?.walletReference?.confirmed;
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
