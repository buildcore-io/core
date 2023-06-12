import {
  Award,
  COL,
  Member,
  Network,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TransactionAwardType,
} from '@build5/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { approveAwardParticipant, createAward, fundAward } from '../../src/runtime/firebase/award';
import { joinSpace } from '../../src/runtime/firebase/space';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
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
import { requestFundsFromFaucet } from '../faucet';

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

    token = await saveToken(space.uid, guardian);

    mockWalletReturnValue(walletSpy, member, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});

    const guardianDocRef = soonDb().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create and fund native award, no reward', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await walletService.send(
      guardianAddress,
      order.payload.targetAddress,
      order.payload.amount,
      {},
    );
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

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
    expect(awardData.nativeTokenStorageDeposit).toBe(0);

    mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [member, member] });
    await testEnv.wrap(approveAwardParticipant)({});

    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${token.uid}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
    let distribution = <TokenDistribution | undefined>await distributionDocRef.get();
    expect(distribution?.totalUnclaimedAirdrop || 0).toBe(0);

    const nttQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionAwardType.BADGE);
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
  await soonDb().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};

const MINTED_TOKEN_ID =
  '0x08f56bb2eefc47c050e67f8ba85d4a08e1de5ac0580fb9e80dc2f62eab97f944350100000000';
