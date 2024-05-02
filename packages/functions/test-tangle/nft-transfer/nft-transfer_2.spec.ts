import { NftTransferRequest, WEN_FUNC } from '@build-5/interfaces';
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

  it('Should transfer one, other is in sale', async () => {
    const nft1 = await h.createAndOrderNft();
    const nft2 = await h.createAndOrderNft();
    await h.mintCollection();

    await h.setAvailableForSale(nft2.uid);

    const request: NftTransferRequest = {
      transfers: [
        { nft: nft1.uid, target: h.member },
        { nft: nft2.uid, target: h.member },
      ],
    };

    mockWalletReturnValue(h.guardian, request);
    const response: { [key: string]: number } = await testEnv.wrap(WEN_FUNC.nftTransfer);
    expect(response[nft1.uid]).toBe(200);
    expect(response[nft2.uid]).toBe(2092);
  });
});
