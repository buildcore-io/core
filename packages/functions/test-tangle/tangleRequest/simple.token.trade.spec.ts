import { database } from '@buildcore/database';
import {
  COL,
  IgnoreWalletReason,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  SUB_COL,
  TangleRequestType,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@buildcore/interfaces';
import { Wallet } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { getWallet, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

describe('Simple token trading', () => {
  let member: string;
  let token: Token;
  let rmsWallet: Wallet;
  let tangleOrder: Transaction;

  beforeAll(async () => {
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    member = await testEnv.createMember();

    token = <Token>{
      project: SOON_PROJECT_ID,
      uid: wallet.getRandomEthAddress(),
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await database().doc(COL.TOKEN, token.uid).create(token);
    await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member).create({
      parentId: token.uid,
      parentCol: COL.TOKEN,
      tokenOwned: 100,
    });

    rmsWallet = await getWallet(Network.RMS);
  });

  it('Should credit on simple token buy', async () => {
    const memberData = <Member>await database().doc(COL.MEMBER, member).get();
    const rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

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
      .where('member', '==', member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get();
    expect(snap.length).toBe(1);
    expect(snap[0]?.payload?.response).toEqual({
      code: WenError.token_in_invalid_status.code,
      message: WenError.token_in_invalid_status.key,
      status: 'error',
    });
  });

  it('Should credit on simple token sell', async () => {
    const memberData = <Member>await database().doc(COL.MEMBER, member).get();
    const rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress!, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.SELL_TOKEN,
          symbol: token.symbol,
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
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
      code: WenError.token_in_invalid_status.code,
      message: WenError.token_in_invalid_status.key,
      status: 'error',
    });
  });

  it('Should set member in case of invalid OTR payment', async () => {
    const memberData = <Member>await database().doc(COL.MEMBER, member).get();
    const rmsAddress = await rmsWallet.getAddressDetails(getAddress(memberData, Network.RMS)!);
    await requestFundsFromFaucet(Network.RMS, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await rmsWallet.send(rmsAddress, tangleOrder.payload.targetAddress!, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.ADDRESS_VALIDATION,
          network: Network.RMS,
        },
      },
      storageDepositReturnAddress: rmsAddress.bech32,
    });

    const query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', rmsAddress.bech32)
      .where(
        'ignoreWalletReason',
        '==',
        IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
      );
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
  });
});
