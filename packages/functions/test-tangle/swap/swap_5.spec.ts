import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Swap,
  SwapStatus,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper, MINTED_TOKEN_ID_1, MINTED_TOKEN_ID_2 } from './Helper';

describe('Swap control test', () => {
  const h = new Helper();

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should create swap with OTR, set open', async () => {
    const tangleOrder = await getTangleOrder(h.network);

    const request = {
      requestType: TangleRequestType.CREATE_SWAP,
      nativeTokens: [
        { id: MINTED_TOKEN_ID_1, amount: 5 },
        { id: MINTED_TOKEN_ID_2, amount: 5 },
      ],
      recipient: h.member,
    };

    const address = await h.wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(h.network, address.bech32, 2 * MIN_IOTA_AMOUNT);

    await h.wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, h.network);

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .orderBy('createdOn');
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });
    let credit = (await creditQuery.get<Transaction>())[0];
    expect(credit.payload.response?.address).toBeDefined();
    expect(credit.payload.response?.swap).toBeDefined();
    const swapAddress = credit.payload.response?.address as string;
    console.log('ok');
    const swapUid = credit.payload.response?.swap!;
    await h.wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: TangleRequestType.SET_SWAP_FUNDED, uid: swapUid } },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, h.network);

    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return (
        snap.length === 2 &&
        snap.reduce((acc, act) => (acc && act.payload.walletReference?.confirmed) || false, true)
      );
    });
    credit = (await creditQuery.get<Transaction>())[1];
    expect(credit.payload.response?.code).toBe(2152);

    await h.wallet.send(address, swapAddress, MIN_IOTA_AMOUNT, {});
    await MnemonicService.store(address.bech32, address.mnemonic, h.network);

    const swapDocRef = build5Db().doc(`${COL.SWAP}/${swapUid}`);
    await wait(async () => {
      const swap = await swapDocRef.get<Swap>();
      return swap?.bidOutputs?.length === 1;
    });

    await h.wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: TangleRequestType.SET_SWAP_FUNDED, uid: swapUid } },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, h.network);

    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return (
        snap.length === 3 &&
        snap.reduce((acc, act) => (acc && act.payload.walletReference?.confirmed) || false, true)
      );
    });

    const swap = await swapDocRef.get<Swap>();
    expect(swap?.bidOutputs?.length).toBe(1);
    expect(swap?.status).toBe(SwapStatus.FUNDED);
  });
});
