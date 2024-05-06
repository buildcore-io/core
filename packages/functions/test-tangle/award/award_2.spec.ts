import { database } from '@buildcore/database';
import {
  Award,
  COL,
  Member,
  Network,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  Token,
  TokenDistribution,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { NftOutput, TimelockUnlockCondition, UnlockConditionType } from '@iota/sdk';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { mergeOutputs } from '../../src/utils/basic-output.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { awaitAllTransactionsForAward } from './common';

const network = Network.RMS;

describe('Create award, native', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let guardianAddress: AddressDetails;
  let walletService: Wallet;
  let token: Token;
  let now: dayjs.Dayjs;

  beforeAll(async () => {
    walletService = await getWallet(network);
  });

  beforeEach(async () => {
    now = dayjs();
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    mockWalletReturnValue(member, { uid: space?.uid });
    await testEnv.wrap(WEN_FUNC.joinSpace);

    token = await saveToken(space.uid, guardian);

    mockWalletReturnValue(member, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(WEN_FUNC.createAward);

    const guardianDocRef = database().doc(COL.MEMBER, guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create and fund award', async () => {
    mockWalletReturnValue(guardian, { uid: award.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount!);
    await requestMintedTokenFromFaucet(
      walletService,
      guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      10,
    );
    await walletService.send(guardianAddress, order.payload.targetAddress!, order.payload.amount!, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: BigInt('0xA') }],
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const awardDocRef = database().doc(COL.AWARD, award.uid);
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

    const distributionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member);
    let distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalUnclaimedAirdrop).toBe(10);

    const nttQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload_type', '==', TransactionPayloadType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 2;
    });

    await awaitAllTransactionsForAward(award.uid);

    const memberDocRef = database().doc(COL.MEMBER, member);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, network);
    await wait(async () => {
      const response = await walletService.client.nftOutputIds([{ address: memberBech32 }]);
      return response.items.length === 2;
    });

    const response = await walletService.client.nftOutputIds([{ address: memberBech32 }]);
    const promises = response.items.map(
      async (outputId) => (await walletService.client.getOutput(outputId)).output as NftOutput,
    );
    const nttOutputs = await Promise.all(promises);
    for (const nttOutput of nttOutputs) {
      const timelock = nttOutput.unlockConditions.find(
        (uc) => uc.type === UnlockConditionType.Timelock,
      ) as TimelockUnlockCondition;
      expect(dayjs.unix(timelock.unixTime).isAfter(now.add(31557600000))).toBe(true);
    }

    const airdropQuery = database().collection(COL.AIRDROP).where('member', '==', member);
    let airdropSnap = await airdropQuery.get();
    expect(airdropSnap.length).toBe(2);

    mockWalletReturnValue(member, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress!,
      claimOrder.payload.amount!,
    );

    await wait(async () => {
      airdropSnap = await airdropQuery.get();
      const allClaimed = airdropSnap.reduce(
        (acc, doc) => acc && doc.status === TokenDropStatus.CLAIMED,
        true,
      );
      return allClaimed;
    });

    await awaitTransactionConfirmationsForToken(token.uid);

    distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalUnclaimedAirdrop).toBe(0);

    const outputs = await walletService.getOutputs(memberBech32, [], false);
    const output = mergeOutputs(Object.values(outputs));
    const nativeToken = output.nativeTokens?.find((nt) => nt.id === MINTED_TOKEN_ID);
    expect(Number(nativeToken?.amount)).toBe(10);

    const creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const burnAliasQuery = database()
      .collection(COL.TRANSACTION)
      .where('payload_type', '==', TransactionPayloadType.BURN_ALIAS)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await burnAliasQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const { amount } = await walletService.getBalance(guardianAddress.bech32);
    expect(amount).toBe(award.nativeTokenStorageDeposit + award.aliasStorageDeposit);
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
    project: SOON_PROJECT_ID,
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
    links: [] as URL[],
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token;
};

export const VAULT_MNEMONIC =
  'cruel pass athlete east topple metal glove reward banana lunch sight jelly guess coil labor swim sniff orphan ramp tackle month panel surface real';
export const MINTED_TOKEN_ID =
  '0x086d27c57107bd6e4b8e0a5e8827ffb30b4bd6acfc780af7d950e232f1b065f7a00100000000';
