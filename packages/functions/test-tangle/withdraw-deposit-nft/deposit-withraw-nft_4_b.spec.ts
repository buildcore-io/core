/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Nft, NftStatus, WenError } from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { updateMember } from '../../src/runtime/firebase/member';
import { withdrawNft } from '../../src/runtime/firebase/nft/index';
import { expectThrow, mockWalletReturnValue } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
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

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { avatarNft: helper.nft?.uid });
    await testEnv.wrap(updateMember)({});

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(withdrawNft)({}), WenError.nft_set_as_avatar.key);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { avatarNft: undefined });
    await testEnv.wrap(updateMember)({});

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: helper.nft!.uid });
    await testEnv.wrap(withdrawNft)({});

    const nftDocRef = soonDb().doc(`${COL.NFT}/${helper.nft?.uid}`);
    const nft = <Nft>await nftDocRef.get();
    expect(nft.status).toBe(NftStatus.WITHDRAWN);
  });
});
