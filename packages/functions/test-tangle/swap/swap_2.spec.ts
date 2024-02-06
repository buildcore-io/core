import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Swap,
  SwapStatus,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { createSwap, setSwapFunded } from '../../src/runtime/firebase/swap';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import {
  awaitLedgerInclusionState,
  requestFundsFromFaucet,
  requestMintedTokenFromFaucet,
} from '../faucet';
import {
  Helper,
  MINTED_TOKEN_ID_1,
  MINTED_TOKEN_ID_2,
  VAULT_MNEMONIC_1,
  VAULT_MNEMONIC_2,
} from './Helper';

describe('Swap control test', () => {
  const h = new Helper();

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should create, offer base token, request minted tokens, ', async () => {
    mockWalletReturnValue(h.spy, h.guardian, {
      network: h.network,
      nativeTokens: [
        { id: MINTED_TOKEN_ID_1, amount: 5 },
        { id: MINTED_TOKEN_ID_2, amount: 5 },
      ],
      recipient: h.member,
    });
    const swapOrder: Transaction = await testEnv.wrap(createSwap)({});

    const swapDocRef = build5Db().doc(`${COL.SWAP}/${swapOrder.payload.swap}`);
    let swap = <Swap>await swapDocRef.get();

    await requestFundsFromFaucet(h.network, swapOrder.payload.targetAddress!, MIN_IOTA_AMOUNT);
    await wait(async () => {
      swap = <Swap>await swapDocRef.get();
      return swap.bidOutputs?.length === 1;
    });

    mockWalletReturnValue(h.spy, h.guardian, { uid: swap.uid });
    await testEnv.wrap(setSwapFunded)({});
    swap = <Swap>await swapDocRef.get();
    expect(swap.status).toBe(SwapStatus.FUNDED);

    const source = await h.wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(h.network, source.bech32, 10 * MIN_IOTA_AMOUNT);

    await requestMintedTokenFromFaucet(h.wallet, source, MINTED_TOKEN_ID_1, VAULT_MNEMONIC_1, 5);
    await requestMintedTokenFromFaucet(h.wallet, source, MINTED_TOKEN_ID_2, VAULT_MNEMONIC_2, 5);

    const blockId = await h.wallet.send(source, swapOrder.payload.targetAddress!, 0, {
      nativeTokens: [{ id: MINTED_TOKEN_ID_1, amount: BigInt(5) }],
    });
    await awaitLedgerInclusionState(blockId);
    await MnemonicService.store(source.bech32, source.mnemonic, h.network);

    await h.wallet.send(source, swapOrder.payload.targetAddress!, 0, {
      nativeTokens: [{ id: MINTED_TOKEN_ID_2, amount: BigInt(5) }],
    });

    await wait(async () => {
      swap = <Swap>await swapDocRef.get();
      return swap.askOutputs?.length === 2;
    });

    expect(swap.askOutputs!.map((nt) => nt.nativeTokens![0].id!)).toEqual([
      MINTED_TOKEN_ID_1,
      MINTED_TOKEN_ID_2,
    ]);
    expect(swap.askOutputs!.map((nt) => nt.nativeTokens![0].amount!)).toEqual(['0x5', '0x5']);

    await wait(async () => {
      swap = <Swap>await swapDocRef.get();
      return swap.status === SwapStatus.FULFILLED;
    });

    let query = build5Db()
      .collection(COL.TRANSACTION)
      .where('payload.swap', '==', swap.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return (
        snap.length === 3 &&
        snap.reduce((acc, act) => (acc && act.payload.walletReference?.confirmed) || false, true)
      );
    });

    query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    let billPayments = await query.get<Transaction>();
    expect(billPayments.length).toBe(1);
    expect(billPayments[0].payload.amount).toBe(MIN_IOTA_AMOUNT);
    expect(billPayments[0].payload.nativeTokens).toEqual([]);
    expect(billPayments[0].payload.nftId).toBeUndefined();

    query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.guardian)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    billPayments = await query.get<Transaction>();
    expect(billPayments.length).toBe(2);
    const nativeTokens = billPayments.map((b) => b.payload.nativeTokens![0].id).sort();
    expect(nativeTokens).toEqual([MINTED_TOKEN_ID_1, MINTED_TOKEN_ID_2].sort());
  });
});
