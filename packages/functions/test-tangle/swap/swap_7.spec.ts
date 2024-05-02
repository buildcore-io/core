import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Member,
  Nft,
  Swap,
  SwapStatus,
  TangleRequestType,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
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

  it('Should create, offer base token, request nft, reject with OTR', async () => {
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

    const guardianDocRef = database().doc(COL.MEMBER, h.guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianAddress = await h.wallet.getAddressDetails(getAddress(guardianData, h.network));
    await wait(async () => {
      const result = await h.wallet.client.nftOutputIds([{ address: guardianAddress.bech32 }]);
      return result.items.length === 2;
    });

    for (const nftUid of nfts) {
      const docRef = database().doc(COL.NFT, nftUid);
      const nft = <Nft>await docRef.get();
      await h.sendNftToAddress(guardianAddress, swap.address, nft.mintingData?.nftId!);
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

    const memberDocRef = database().doc(COL.MEMBER, h.member);
    const memberData = <Member>await memberDocRef.get();
    const memberAddress = await h.wallet.getAddressDetails(getAddress(memberData, h.network));
    await requestFundsFromFaucet(h.network, memberAddress.bech32, MIN_IOTA_AMOUNT);

    const tangleOrder = await getTangleOrder(h.network);
    await h.wallet.send(memberAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: TangleRequestType.REJECT_SWAP, uid: swap.uid } },
    });

    await wait(async () => {
      swap = <Swap>await swapDocRef.get();
      return swap.status === SwapStatus.REJECTED;
    });

    let query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload_swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get();
      return (
        snap.length === 2 &&
        snap[0].payload.walletReference?.confirmed &&
        snap[1].payload.walletReference?.confirmed
      );
    });

    query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('payload_swap', '==', swap.uid);
    await wait(async () => {
      const snap = await query.get();
      return (
        snap.length === 2 &&
        snap[0].payload.walletReference?.confirmed &&
        snap[1].payload.walletReference?.confirmed
      );
    });
    const snap = await query.get();
    expect(snap[0].payload.targetAddress).toBe(guardianAddress.bech32);
    expect(snap[1].payload.targetAddress).toBe(guardianAddress.bech32);

    const nftIds = await h.wallet.client.nftOutputIds([{ address: guardianAddress.bech32 }]);
    expect(nftIds.items.length).toBe(2);
  });
});
