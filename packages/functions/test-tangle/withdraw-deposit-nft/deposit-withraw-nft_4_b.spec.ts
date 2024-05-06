/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import { COL, Nft, NftStatus, WEN_FUNC, WenError } from '@buildcore/interfaces';
import { expectThrow } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, can not withraw if set as avatar', async () => {
    await helper.createAndOrderNft();
    await helper.mintCollection();

    mockWalletReturnValue(helper.guardian!, { avatarNft: helper.nft?.uid });
    await testEnv.wrap(WEN_FUNC.updateMember);

    mockWalletReturnValue(helper.guardian!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(WEN_FUNC.withdrawNft), WenError.nft_set_as_avatar.key);

    mockWalletReturnValue(helper.guardian!, { avatarNft: undefined });
    await testEnv.wrap(WEN_FUNC.updateMember);

    mockWalletReturnValue(helper.guardian!, { nft: helper.nft!.uid });
    await testEnv.wrap(WEN_FUNC.withdrawNft);

    const nftDocRef = database().doc(COL.NFT, helper.nft?.uid!);
    const nft = <Nft>await nftDocRef.get();
    expect(nft.status).toBe(NftStatus.WITHDRAWN);
  });
});
