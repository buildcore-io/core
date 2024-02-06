import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Nft,
  Swap,
  SwapStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { createCollection } from '../../src/runtime/firebase/collection';
import { withdrawNft } from '../../src/runtime/firebase/nft';
import { createSwap, rejectSwap, setSwapFunded } from '../../src/runtime/firebase/swap';
import { getAddress } from '../../src/utils/address.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, MINTED_TOKEN_ID_1, VAULT_MNEMONIC_1 } from './Helper';

describe('Swap control test', () => {
  const h = new Helper();
  let nfts: string[];

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();

    mockWalletReturnValue(h.spy, h.guardian, h.createDummyCollection(h.space.uid, h.space.uid));
    h.collection = (await testEnv.wrap(createCollection)({})).uid;

    nfts = [(await h.createAndOrderNft(true)).uid, (await h.createAndOrderNft(true)).uid];

    await h.mintCollection();

    mockWalletReturnValue(h.spy, h.guardian!, { nft: nfts[0] });
    await testEnv.wrap(withdrawNft)({});

    mockWalletReturnValue(h.spy, h.guardian!, { nft: nfts[1] });
    await testEnv.wrap(withdrawNft)({});
  });

  it('Should create, offer base token, request nft', async () => {
    mockWalletReturnValue(h.spy, h.member, {
      network: h.network,
      nativeTokens: [{ id: MINTED_TOKEN_ID_1, amount: 5 }],
      nfts,
      recipient: h.guardian,
    });
    const swapOrder: Transaction = await testEnv.wrap(createSwap)({});

    const swapDocRef = build5Db().doc(`${COL.SWAP}/${swapOrder.payload.swap}`);
    let swap = <Swap>await swapDocRef.get();

    await requestFundsFromFaucet(h.network, swapOrder.payload.targetAddress!, MIN_IOTA_AMOUNT);
    await wait(async () => {
      swap = <Swap>await swapDocRef.get();
      return swap.bidOutputs?.length === 1;
    });

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${h.guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const sourceAddress = await h.wallet.getAddressDetails(getAddress(guardianData, h.network));
    await wait(async () => {
      const result = await h.wallet.client.nftOutputIds([{ address: sourceAddress.bech32 }]);
      return result.items.length === 2;
    });
    for (const nftUid of nfts) {
      const docRef = build5Db().doc(`${COL.NFT}/${nftUid}`);
      const nft = <Nft>await docRef.get();
      await h.sendNftToAddress(sourceAddress, swap.address, nft.mintingData?.nftId!);
    }

    const source = await h.wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(h.network, source.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(h.wallet, source, MINTED_TOKEN_ID_1, VAULT_MNEMONIC_1, 5);
    await h.wallet.send(source, swapOrder.payload.targetAddress!, 0, {
      nativeTokens: [{ id: MINTED_TOKEN_ID_1, amount: BigInt(5) }],
    });

    await wait(async () => {
      swap = <Swap>await swapDocRef.get();
      return swap.askOutputs?.length === 3 && swap.bidOutputs?.length === 1;
    });

    mockWalletReturnValue(h.spy, h.member, { uid: swap.uid });
    await testEnv.wrap(setSwapFunded)({});
    swap = <Swap>await swapDocRef.get();
    expect(swap.status).toBe(SwapStatus.FULFILLED);

    let query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && (snap[0].payload.walletReference?.confirmed || false);
    });

    query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return (
        snap.length === 2 &&
        (snap[0].payload.walletReference?.confirmed || false) &&
        (snap[1].payload.walletReference?.confirmed || false)
      );
    });

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${h.member}`);
    const member = <Member>await memberDocRef.get();
    const response = await h.wallet.client.nftOutputIds([
      { address: getAddress(member, h.network) },
    ]);
    expect(response.items.length).toBe(2);

    query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.guardian)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && (snap[0].payload.walletReference?.confirmed || false);
    });

    mockWalletReturnValue(h.spy, h.member, { uid: swap.uid });
    await expectThrow(testEnv.wrap(rejectSwap)({}), WenError.swap_already_fulfilled.key);
  });
});
