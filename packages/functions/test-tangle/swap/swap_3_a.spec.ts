import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Member,
  Nft,
  Swap,
  SwapStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { getAddress } from '../../src/utils/address.utils';
import { expectThrow, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    mockWalletReturnValue(h.guardian, h.createDummyCollection(h.space.uid, h.space.uid));
    h.collection = (await testEnv.wrap<Collection>(WEN_FUNC.createCollection)).uid;

    nfts = [(await h.createAndOrderNft(true)).uid, (await h.createAndOrderNft(true)).uid];

    await h.mintCollection();

    mockWalletReturnValue(h.guardian!, { nft: nfts[0] });
    await testEnv.wrap(WEN_FUNC.withdrawNft);

    mockWalletReturnValue(h.guardian!, { nft: nfts[1] });
    await testEnv.wrap(WEN_FUNC.withdrawNft);
  });

  it('Should create, offer base token, request nft', async () => {
    mockWalletReturnValue(h.member, {
      network: h.network,
      nativeTokens: [{ id: MINTED_TOKEN_ID_1, amount: 5 }],
      nfts,
      recipient: h.guardian,
    });
    const swapOrder = await testEnv.wrap<Transaction>(WEN_FUNC.createSwap);

    const swapDocRef = database().doc(COL.SWAP, swapOrder.payload.swap!);
    let swap = <Swap>await swapDocRef.get();

    await requestFundsFromFaucet(h.network, swapOrder.payload.targetAddress!, MIN_IOTA_AMOUNT);
    await wait(async () => {
      swap = <Swap>await swapDocRef.get();
      return swap.bidOutputs?.length === 1;
    });
    mockWalletReturnValue(h.member, { uid: swap.uid });
    await testEnv.wrap(WEN_FUNC.setSwapFunded);
    swap = <Swap>await swapDocRef.get();
    expect(swap.status).toBe(SwapStatus.FUNDED);

    const guardianDocRef = database().doc(COL.MEMBER, h.guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const sourceAddress = await h.wallet.getAddressDetails(getAddress(guardianData, h.network));

    await wait(async () => {
      const result = await h.wallet.client.nftOutputIds([{ address: sourceAddress.bech32 }]);
      return result.items.length === 2;
    });
    for (const nftUid of nfts) {
      const docRef = database().doc(COL.NFT, nftUid);
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

    let query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload_swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && (snap[0].payload.walletReference?.confirmed || false);
    });

    query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload_swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get();
      return (
        snap.length === 2 &&
        (snap[0].payload.walletReference?.confirmed || false) &&
        (snap[1].payload.walletReference?.confirmed || false)
      );
    });

    const memberDocRef = database().doc(COL.MEMBER, h.member);
    const member = <Member>await memberDocRef.get();
    const response = await h.wallet.client.nftOutputIds([
      { address: getAddress(member, h.network) },
    ]);
    expect(response.items.length).toBe(2);

    query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.guardian)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload_swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && (snap[0].payload.walletReference?.confirmed || false);
    });

    mockWalletReturnValue(h.member, { uid: swap.uid });
    await expectThrow(testEnv.wrap(WEN_FUNC.rejectSwap), WenError.swap_already_fulfilled.key);
  });
});
