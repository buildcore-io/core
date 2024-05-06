import { database } from '@buildcore/database';
import {
  Award,
  COL,
  Network,
  SOON_PROJECT_ID,
  Space,
  Token,
  TokenStatus,
  Transaction,
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
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

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
    const guardianData = await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create and issue to upper case address', async () => {
    mockWalletReturnValue(guardian, { uid: award.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await requestMintedTokenFromFaucet(
      walletService,
      guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      15,
    );
    await walletService.send(guardianAddress, order.payload.targetAddress!, order.payload.amount!, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: BigInt(15) }],
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const awardDocRef = database().doc(COL.AWARD, award.uid);
    await wait(async () => {
      const award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });

    mockWalletReturnValue(guardian, {
      award: award.uid,
      members: [member.toUpperCase()],
    });
    await testEnv.wrap(WEN_FUNC.approveParticipantAward);

    const snap = await database().collection(COL.AIRDROP).where('member', '==', member).get();
    expect(snap.length).toBe(1);
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
    total: 3,
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
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token;
};

export const VAULT_MNEMONIC =
  'unfair traffic retire voyage timber guide label amateur armed gadget fatigue retreat quiz belt century entire accuse what inner ticket can general giggle latin';
export const MINTED_TOKEN_ID =
  '0x08d6fdcd4e3bea675746239a3b411294d4c40774be59081e6bbc61e3424b6590ff0100000000';
