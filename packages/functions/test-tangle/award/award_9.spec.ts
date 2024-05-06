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
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

const network = Network.RMS;

describe('Create award, native', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let guardianAddress: AddressDetails;
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

    token = await saveToken(space.uid, guardian);

    mockWalletReturnValue(member, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(WEN_FUNC.createAward);

    const guardianDocRef = database().doc(COL.MEMBER, guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create and fund native award, no reward', async () => {
    mockWalletReturnValue(guardian, { uid: award.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await walletService.send(
      guardianAddress,
      order.payload.targetAddress!,
      order.payload.amount!,
      {},
    );
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
    expect(awardData.nativeTokenStorageDeposit).toBe(0);

    mockWalletReturnValue(guardian, { award: award.uid, members: [member, member] });
    await testEnv.wrap(WEN_FUNC.approveParticipantAward);

    const distributionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member);
    let distribution = <TokenDistribution | undefined>await distributionDocRef.get();
    expect(distribution?.totalUnclaimedAirdrop || 0).toBe(0);

    const nttQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload_type', '==', TransactionPayloadType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 2;
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
    tokenReward: 0,
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
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token;
};

const MINTED_TOKEN_ID =
  '0x0833fb03653c5312a4d02b03c1999c4d03f43c532431cc8684f3941a69bd32fbb90100000000';
