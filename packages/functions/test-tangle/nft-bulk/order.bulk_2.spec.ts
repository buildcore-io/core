import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Nft,
  NftPurchaseBulkRequest,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft bulk order', () => {
  const h = new Helper();

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should order 2 nfts, buy only one', async () => {
    const { collection: col1, nft: nft1 } = await h.createCollectionAndNft(h.member, h.space);
    const { collection: col2, nft: nft2 } = await h.createCollectionAndNft(h.member, h.space);

    const request: NftPurchaseBulkRequest = {
      orders: [
        { collection: col1.uid, nft: nft1.uid },
        { collection: col2.uid, nft: nft2.uid },
      ],
    };
    mockWalletReturnValue(h.member, request);
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderNftBulk);

    const nft1DocRef = database().doc(COL.NFT, nft1.uid);
    const nft2DocRef = database().doc(COL.NFT, nft2.uid);
    await nft2DocRef.update({ locked: true });

    await requestFundsFromFaucet(
      order.network,
      order.payload.targetAddress!,
      order.payload.amount!,
    );

    await wait(async () => {
      const nft1 = <Nft>await nft1DocRef.get();
      return nft1.owner === h.member;
    });

    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', h.member);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const snap = await query.get();
    expect(snap[0].payload.amount).toBe(1 * MIN_IOTA_AMOUNT);
  });
});
