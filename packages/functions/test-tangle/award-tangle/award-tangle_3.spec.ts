import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  NativeToken,
  Network,
  Space,
  TangleRequestType,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol, wait } from '../../test/controls/common';
import { getWallet, MEDIA } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

let walletSpy: any;

describe('Award tangle request', () => {
  let guardian: string;
  let space: Space;
  let guardianAddress: AddressDetails;
  let walletService: Wallet;
  let token: Token;
  let tangleOrder: Transaction;

  const beforeEach = async (network: Network) => {
    tangleOrder = await getTangleOrder(network);

    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = await getWallet(network);
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    token = await saveToken(space.uid, guardian, network);

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  };

  it.each([Network.RMS, Network.ATOI])(
    'Should create and fund with tangle request',
    async (network: Network) => {
      await beforeEach(network);

      const newAward = awardRequest(space.uid, token.symbol, network);
      await requestFundsFromFaucet(network, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
      await walletService.send(
        guardianAddress,
        tangleOrder.payload.targetAddress!,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: { request: { requestType: TangleRequestType.AWARD_CREATE, ...newAward } },
        },
      );
      await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

      const creditQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
        .where('member', '==', guardian);
      await wait(async () => {
        const snap = await creditQuery.get();
        return snap.length === 1;
      });
      let snap = await creditQuery.get();
      let credit = snap[0] as Transaction;
      expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);
      const awardDocRef = build5Db().doc(`${COL.AWARD}/${credit.payload.response!.award}`);

      await requestMintedTokenFromFaucet(
        walletService,
        guardianAddress,
        MINTED_TOKEN_ID,
        VAULT_MNEMONIC,
        (credit.payload.response!.nativeTokens! as any)[0].amount,
      );
      await walletService.send(
        guardianAddress,
        credit.payload.response!.address as string,
        credit.payload.response!.amount as number,
        {
          nativeTokens: (credit.payload.response!.nativeTokens as NativeToken[]).map((nt: any) => ({
            ...nt,
            amount: BigInt(nt.amount),
          })),
        },
      );

      await wait(async () => {
        const award = (await awardDocRef.get()) as Award;
        return award.funded;
      });
    },
  );
});

const awardRequest = (space: string, tokenSymbol: string, network: Network) => ({
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

const saveToken = async (space: string, guardian: string, network: Network) => {
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
      network,
      tokenId: MINTED_TOKEN_ID,
    },
  };
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};

export const VAULT_MNEMONIC =
  'wise push option delay harvest reward equal sketch seed mystery cruise exact photo cabbage ill clump pen lab orphan cradle creek march install health';
export const MINTED_TOKEN_ID =
  '0x08a7a6e15732dac0262fd0e102dd293acdf1eb5cc9cd45512ab818fb7bae4aebff0100000000';
