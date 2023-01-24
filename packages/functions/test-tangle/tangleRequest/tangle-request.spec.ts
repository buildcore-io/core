import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
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
  let rmsWallet: SmrWallet;
  let tangleOrder: Transaction;
  let rmsAddress: AddressDetails;
  let token: Token;

  beforeAll(async () => {
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    rmsWallet = (await getWallet(Network.RMS)) as SmrWallet;
    const space = await createSpace(walletSpy, member);
    token = await saveToken(space.uid, member);

    const memberData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()
    );
    rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 10 * MIN_IOTA_AMOUNT);
  });

  it('Should return amount, multiple users with same address', async () => {
    const member2 = await createMember(walletSpy);
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${member2}`)
      .set({ validatedAddress: { [Network.RMS]: rmsAddress.bech32 } }, { merge: true });

    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: 'ASD',
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
    });

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', rmsAddress.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.size > 0 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get();
    expect(snap.size).toBe(1);
    expect(snap.docs[0].data()?.payload?.response).toEqual({
      code: WenError.multiple_members_with_same_address.code,
      message: WenError.multiple_members_with_same_address.key,
      status: 'error',
    });
  });

  it('Should process multiple request at the same time', async () => {
    const requests = Array.from(Array(10)).map(() => ({
      toAddress: tangleOrder.payload.targetAddress,
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
    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', member);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 10;
    });
  });

  it('Should throw, invalid request type', async () => {
    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: 'wrong_request' } },
    });

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.size > 0 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get();
    expect(snap.size).toBe(1);
    expect(snap.docs[0].data()?.payload?.response).toEqual({
      code: WenError.invalid_tangle_request_type.code,
      message: WenError.invalid_tangle_request_type.key,
      status: 'error',
    });
  });
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
    status: TokenStatus.BASE,
    access: 0,
    icon: MEDIA,
    mintingData: {
      network: Network.ATOI,
    },
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};
