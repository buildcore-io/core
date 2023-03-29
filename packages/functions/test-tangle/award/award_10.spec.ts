import { HexHelper } from '@iota/util.js-next';
import { Award, COL, Member, Network, Space, Token, TokenStatus } from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
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
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

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

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create and issue to upper case address', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await requestMintedTokenFromFaucet(
      walletService,
      guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      15,
    );
    await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(15)) }],
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
    await wait(async () => {
      const award = <Award>(await awardDocRef.get()).data();
      return award.approved && award.funded;
    });

    mockWalletReturnValue(walletSpy, guardian, {
      award: award.uid,
      members: [member.toUpperCase()],
    });
    await testEnv.wrap(approveAwardParticipant)({});

    const snap = await admin
      .firestore()
      .collection(COL.AIRDROP)
      .where('member', '==', member)
      .get();
    expect(snap.size).toBe(1);
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
