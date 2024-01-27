import { build5Db } from '@build-5/database';
import { COL, Nft, NftTransferRequest, Transaction, TransactionType } from '@build-5/interfaces';
import { nftTransfer } from '../../src/runtime/firebase/nft';
import { mockWalletReturnValue } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Nft transfer', () => {
  const h = new Helper();

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should transfer two NFTs', async () => {
    let nft1 = await h.createAndOrderNft();
    let nft2 = await h.createAndOrderNft();
    await h.mintCollection();

    const request: NftTransferRequest = {
      transfers: [
        { nft: nft1.uid, target: h.member },
        { nft: nft2.uid, target: h.member },
      ],
    };

    mockWalletReturnValue(h.spy, h.guardian, request);
    const response: { [key: string]: number } = await testEnv.wrap(nftTransfer)({});
    expect(response[nft1.uid]).toBe(200);
    expect(response[nft2.uid]).toBe(200);

    const transfers = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.guardian)
      .where('type', '==', TransactionType.NFT_TRANSFER)
      .get<Transaction>();
    expect(transfers.length).toBe(2);

    const nft1DocRef = build5Db().doc(`${COL.NFT}/${nft1.uid}`);
    nft1 = <Nft>await nft1DocRef.get();
    expect(nft1.owner).toBe(h.member);

    const nft2DocRef = build5Db().doc(`${COL.NFT}/${nft2.uid}`);
    nft2 = <Nft>await nft2DocRef.get();
    expect(nft2.owner).toBe(h.member);
  });
});
