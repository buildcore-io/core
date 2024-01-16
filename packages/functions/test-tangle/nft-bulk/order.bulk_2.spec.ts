import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Nft,
  NftPurchaseBulkRequest,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { orderNftBulk } from '../../src/runtime/firebase/nft';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft bulk order', () => {
  const h = new Helper();

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should order 2 nfts, buy only one', async () => {
    const { collection: col1, nft: nft1 } = await h.createColletionAndNft(h.member, h.space);
    const { collection: col2, nft: nft2 } = await h.createColletionAndNft(h.member, h.space);

    const request: NftPurchaseBulkRequest = {
      orders: [
        { collection: col1.uid, nft: nft1.uid },
        { collection: col2.uid, nft: nft2.uid },
      ],
    };
    mockWalletReturnValue(h.walletSpy, h.member, request);
    const order: Transaction = await testEnv.wrap(orderNftBulk)({});

    const nft1DocRef = build5Db().doc(`${COL.NFT}/${nft1.uid}`);
    const nft2DocRef = build5Db().doc(`${COL.NFT}/${nft2.uid}`);
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

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', h.member);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1;
    });
    const snap = await query.get<Transaction>();
    expect(snap[0].payload.amount).toBe(1 * MIN_IOTA_AMOUNT);
  });
});
