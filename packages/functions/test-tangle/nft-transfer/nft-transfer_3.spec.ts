import { build5Db } from '@build-5/database';
import { COL, NftTransferRequest, Transaction, TransactionType } from '@build-5/interfaces';
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

  it('Should not transfer, not owner', async () => {
    const nft1 = await h.createAndOrderNft();
    const nft2 = await h.createAndOrderNft();
    await h.mintCollection();

    const request: NftTransferRequest = {
      transfers: [
        { nft: nft1.uid, target: h.member },
        { nft: nft2.uid, target: h.member },
      ],
    };

    mockWalletReturnValue(h.spy, h.member, request);
    const response: { [key: string]: number } = await testEnv.wrap(nftTransfer)({});
    expect(response[nft1.uid]).toBe(2066);
    expect(response[nft2.uid]).toBe(2066);

    const transfers = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.NFT_TRANSFER)
      .get<Transaction>();
    expect(transfers.length).toBe(0);
  });
});
