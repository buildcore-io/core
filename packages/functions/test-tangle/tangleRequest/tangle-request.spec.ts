import { database } from '@buildcore/database';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  TangleRequestType,
  Token,
  TokenStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  WenError,
} from '@buildcore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

describe('Tangle request spec', () => {
  let member: string;
  let rmsWallet: Wallet;
  let tangleOrder: Transaction;
  let rmsAddress: AddressDetails;
  let token: Token;

  beforeAll(async () => {
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    member = await testEnv.createMember();
    rmsWallet = await getWallet(Network.RMS);
    const space = await testEnv.createSpace(member);
    token = await saveToken(space.uid, member);

    const memberData = <Member>await database().doc(COL.MEMBER, member).get();
    rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 10 * MIN_IOTA_AMOUNT);
  });

  it('Should return amount, multiple users with same address', async () => {
    const member2 = await testEnv.createMember();
    await database().doc(COL.MEMBER, member2).upsert({ rmsAddress: rmsAddress.bech32 });

    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress!, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: token.symbol,
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
    });

    const query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', rmsAddress.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get();
    expect(snap.length).toBe(1);
    expect(snap[0]?.payload?.response).toEqual({
      code: WenError.multiple_members_with_same_address.code,
      message: WenError.multiple_members_with_same_address.key,
      status: 'error',
    });
  });

  it('Should use sender as owner when multiple users', async () => {
    const address = await rmsWallet.getNewIotaAddressDetails();

    await requestFundsFromFaucet(Network.RMS, address.bech32, MIN_IOTA_AMOUNT);

    await rmsWallet.send(address, tangleOrder.payload.targetAddress!, 0.2 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: token.symbol,
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic);

    const query = database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', address.bech32)
      .where('type', '==', TokenTradeOrderType.BUY);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const member2 = await testEnv.createMember();
    await database().doc(COL.MEMBER, member2).upsert({ rmsAddress: rmsAddress.bech32 });
    const member3 = await testEnv.createMember();
    await database().doc(COL.MEMBER, member3).upsert({ rmsAddress: rmsAddress.bech32 });

    await rmsWallet.send(address, tangleOrder.payload.targetAddress!, 0.2 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: token.symbol,
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
    });

    await wait(async () => {
      const snap = await query.get();
      return snap.length === 2;
    });
  });

  it('Should process multiple request at the same time', async () => {
    const requests = Array.from(Array(10)).map(() => ({
      toAddress: tangleOrder.payload.targetAddress!,
      amount: MIN_IOTA_AMOUNT,
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: token.symbol,
          count: 1,
          price: MIN_IOTA_AMOUNT,
        },
      },
    }));
    await rmsWallet.sendToMany(rmsAddress, requests, {});
    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', member);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 10;
    });
  });

  it('Should throw, invalid request type', async () => {
    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress!, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: 'wrong_request' } },
    });

    const query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get();
    expect(snap.length).toBe(1);
    expect(snap[0]?.payload?.response).toEqual({
      code: WenError.invalid_tangle_request_type.code,
      message: WenError.invalid_tangle_request_type.key,
      status: 'error',
    });
  });
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
    },
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token as Token;
};
