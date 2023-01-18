import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  SUB_COL,
  TangleRequestType,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, getRandomSymbol, wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

let walletSpy: any;

describe('Simple token trading', () => {
  let member: string;
  let token: Token;
  let rmsWallet: SmrWallet;
  let tangleOrder: Transaction;

  beforeAll(async () => {
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);

    token = <Token>{
      uid: wallet.getRandomEthAddress(),
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
      .create({
        parentId: token.uid,
        parentCol: COL.TOKEN,
        tokenOwned: 100,
      });

    rmsWallet = (await getWallet(Network.RMS)) as SmrWallet;
  });

  it('Should credit on simple token buy', async () => {
    const memberData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()
    );
    const rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: token.symbol,
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
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
      code: WenError.token_in_invalid_status.code,
      message: WenError.token_in_invalid_status.key,
      status: 'error',
    });
  });

  it('Should credit on simple token sell', async () => {
    const memberData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()
    );
    const rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.SELL_TOKEN,
          symbol: token.symbol,
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
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
      code: WenError.token_in_invalid_status.code,
      message: WenError.token_in_invalid_status.key,
      status: 'error',
    });
  });
});
