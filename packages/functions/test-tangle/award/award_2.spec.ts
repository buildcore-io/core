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
  Network,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDropStatus,
  TokenStatus,
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
import { joinSpace } from '../../src/runtime/firebase/space';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { mergeOutputs } from '../../src/utils/basic-output.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { awaitAllTransactionsForAward } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, native', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let guardianAddress: AddressDetails;
  let walletService: SmrWallet;
  let token: Token;
  let now: dayjs.Dayjs;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = (await WalletService.newWallet(network)) as SmrWallet;
  });

  beforeEach(async () => {
    now = dayjs();
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    token = await saveToken(space.uid, guardian);

    mockWalletReturnValue(walletSpy, member, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create and fund award', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await requestMintedTokenFromFaucet(
      walletService,
      guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      10,
    );
    await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: '0xA' }],
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

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

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
    let distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.totalUnclaimedAirdrop).toBe(10);

    const nttQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionAwardType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.size === 2;
    });

    await awaitAllTransactionsForAward(award.uid);

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>(await memberDocRef.get()).data();
    const memberBech32 = getAddress(memberData, network);
    const indexer = new IndexerPluginClient(walletService.client);
    await wait(async () => {
      const response = await indexer.nfts({ addressBech32: memberBech32 });
      return response.items.length === 2;
    });

    const response = await indexer.nfts({ addressBech32: memberBech32 });
    const promises = response.items.map(
      async (outputId) => (await walletService.client.output(outputId)).output as INftOutput,
    );
    const nttOutputs = await Promise.all(promises);
    for (const nttOutput of nttOutputs) {
      const timelock = nttOutput.unlockConditions.find(
        (uc) => uc.type === TIMELOCK_UNLOCK_CONDITION_TYPE,
      ) as ITimelockUnlockCondition;
      expect(dayjs.unix(timelock.unixTime).isAfter(now.add(31557600000))).toBe(true);
    }

    const airdropQuery = admin.firestore().collection(COL.AIRDROP).where('member', '==', member);
    let airdropSnap = await airdropQuery.get();
    expect(airdropSnap.size).toBe(2);

    mockWalletReturnValue(walletSpy, member, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      airdropSnap = await airdropQuery.get();
      const allClaimed = airdropSnap.docs.reduce(
        (acc, doc) => acc && doc.data().status === TokenDropStatus.CLAIMED,
        true,
      );
      return allClaimed;
    });

    await awaitTransactionConfirmationsForToken(token.uid);

    distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.totalUnclaimedAirdrop).toBe(0);

    const outputs = await walletService.getOutputs(memberBech32, [], false);
    const output = mergeOutputs(Object.values(outputs));
    const nativeToken = output.nativeTokens?.find((nt) => nt.id === MINTED_TOKEN_ID);
    expect(Number(nativeToken?.amount)).toBe(10);

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size === 1 && snap.docs[0]?.data()?.payload?.walletReference?.confirmed;
    });

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
    expect(balance).toBe(award.nativeTokenStorageDeposit + award.aliasStorageDeposit);
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
    tokenReward: 5,
    tokenSymbol,
    lockTime: 31557600000,
  },
  network,
});

const saveToken = async (space: string, guardian: string) => {
  const token = {
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: wallet.getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.MINTED,
    access: 0,
    icon: MEDIA,
    mintingData: {
      network: Network.RMS,
      tokenId: MINTED_TOKEN_ID,
    },
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};

export const VAULT_MNEMONIC =
  'media income depth opera health hybrid person expect supply kid napkin science maze believe they inspire hockey random escape size below monkey lemon veteran';

export const MINTED_TOKEN_ID =
  '0x08f56bb2eefc47c050e67f8ba85d4a08e1de5ac0580fb9e80dc2f62eab97f944350100000000';
