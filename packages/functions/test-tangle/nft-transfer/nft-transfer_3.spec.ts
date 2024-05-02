import { database } from '@buildcore/database';
import { COL, NftTransferRequest, TransactionType, WEN_FUNC } from '@buildcore/interfaces';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    mockWalletReturnValue(h.member, request);
    const response: { [key: string]: number } = await testEnv.wrap(WEN_FUNC.nftTransfer);
    expect(response[nft1.uid]).toBe(2066);
    expect(response[nft2.uid]).toBe(2066);

    const transfers = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.NFT_TRANSFER)
      .get();
    expect(transfers.length).toBe(0);
  });
});
