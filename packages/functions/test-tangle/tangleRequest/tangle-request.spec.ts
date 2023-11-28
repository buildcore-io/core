import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  TangleRequestType,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol, wait } from '../../test/controls/common';
import { getWallet, MEDIA } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

let walletSpy: any;

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
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    rmsWallet = await getWallet(Network.RMS);
    const space = await createSpace(walletSpy, member);
    token = await saveToken(space.uid, member);

    const memberData = <Member>await build5Db().doc(`${COL.MEMBER}/${member}`).get();
    rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 10 * MIN_IOTA_AMOUNT);
  });

  it('Should return amount, multiple users with same address', async () => {
    const member2 = await createMember(walletSpy);
    await build5Db()
      .doc(`${COL.MEMBER}/${member2}`)
      .set({ validatedAddress: { [Network.RMS]: rmsAddress.bech32 } }, true);

    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress!, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: 'ASD',
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
    });

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', rmsAddress.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get<Transaction>();
    expect(snap.length).toBe(1);
    expect(snap[0]?.payload?.response).toEqual({
      code: WenError.multiple_members_with_same_address.code,
      message: WenError.multiple_members_with_same_address.key,
      status: 'error',
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
    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', member);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 10;
    });
  });

  it('Should throw, invalid request type', async () => {
    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress!, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: 'wrong_request' } },
    });

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get<Transaction>();
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
    status: TokenStatus.BASE,
    access: 0,
    icon: MEDIA,
    mintingData: {
      network: Network.ATOI,
    },
  };
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};
