import { COL, Nft, NftAvailable, NftStatus, WEN_FUNC, WenError } from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { createMember, updateMember } from '../../src/runtime/firebase/member';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../test/set-up';
import { expectThrow, mockWalletReturnValue } from './common';

let walletSpy: any;

describe('MemberController: ' + WEN_FUNC.createMember, () => {
  it('successfully create member', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    const member = await testEnv.wrap(createMember)(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());
    expect(member?.createdOn).toBeDefined();
    expect(member?.updatedOn).toBeDefined();
  });
});

describe('MemberController: ' + WEN_FUNC.updateMember, () => {
  let dummyAddress: any;
  let doc: any;

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, dummyAddress, {});
    doc = await testEnv.wrap(createMember)(dummyAddress);
    expect(doc?.uid).toEqual(dummyAddress.toLowerCase());
  });

  it('successfully update member', async () => {
    const updateParams = {
      name: wallet.getRandomEthAddress(),
      about: 'He rocks',
      discord: 'adamkun#1233',
      twitter: 'asdasd',
      github: 'asdasda',
    };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    const uMember: any = await testEnv.wrap(updateMember)({});
    expect(uMember?.name).toEqual(updateParams.name);
    expect(uMember?.about).toEqual('He rocks');
    expect(uMember?.discord).toEqual(updateParams.discord);
    expect(uMember?.twitter).toEqual(updateParams.twitter);
    expect(uMember?.github).toEqual(updateParams.github);
    walletSpy.mockRestore();
  });

  it('fail to update member username exists already', async () => {
    const updateParams = { name: 'abcd' + Math.floor(Math.random() * 1000) };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    const uMember = await testEnv.wrap(updateMember)({});
    expect(uMember?.name).toEqual(updateParams.name);

    const dummyAddress2 = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, dummyAddress2, {});
    const cMember = await testEnv.wrap(createMember)(dummyAddress2);
    expect(cMember?.uid).toEqual(dummyAddress2.toLowerCase());

    mockWalletReturnValue(walletSpy, dummyAddress2, { name: updateParams.name });
    await expectThrow(testEnv.wrap(updateMember)({}), WenError.member_username_exists.key);
  });

  it('unset discord', async () => {
    const updateParams = { discord: undefined };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    const uMember = await testEnv.wrap(updateMember)({});
    expect(uMember?.discord).toEqual(null);
    walletSpy.mockRestore();
  });

  it('Should set nft as avatar, then unset', async () => {
    const nft = {
      uid: wallet.getRandomEthAddress(),
      media: MEDIA,
      owner: dummyAddress,
      status: NftStatus.MINTED,
      available: NftAvailable.UNAVAILABLE,
    };
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
    await nftDocRef.create(nft);
    const updateParams = { avatarNft: nft.uid };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    let uMember = await testEnv.wrap(updateMember)({});
    expect(uMember.avatarNft).toBe(nft.uid);
    expect(uMember.avatar).toBe(MEDIA);

    let nftData = await nftDocRef.get<Nft>();
    expect(nftData?.setAsAvatar).toBe(true);

    mockWalletReturnValue(walletSpy, dummyAddress, { avatarNft: undefined });
    uMember = await testEnv.wrap(updateMember)({});
    expect(uMember.avatarNft).toBeNull();
    expect(uMember.avatar).toBeNull();

    nftData = await nftDocRef.get();
    expect(nftData?.setAsAvatar).toBe(false);
  });

  it('Should set nft as avatar, when available field is missing', async () => {
    const nft = {
      uid: wallet.getRandomEthAddress(),
      media: MEDIA,
      owner: dummyAddress,
      status: NftStatus.MINTED,
    };
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
    await nftDocRef.create(nft);
    const updateParams = { avatarNft: nft.uid };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    let uMember = await testEnv.wrap(updateMember)({});
    expect(uMember.avatarNft).toBe(nft.uid);
    expect(uMember.avatar).toBe(MEDIA);
  });

  it('Should throw, invalid nft not nft owner', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, { avatarNft: wallet.getRandomEthAddress() });
    await expectThrow(testEnv.wrap(updateMember)({}), WenError.nft_does_not_exists.key);

    const nft = { uid: wallet.getRandomEthAddress(), media: MEDIA };
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.create(nft);
    mockWalletReturnValue(walletSpy, dummyAddress, { avatarNft: nft.uid });
    await expectThrow(testEnv.wrap(updateMember)({}), WenError.you_must_be_the_owner_of_nft.key);

    await nftDocRef.update({ status: NftStatus.WITHDRAWN, owner: dummyAddress });
    mockWalletReturnValue(walletSpy, dummyAddress, { avatarNft: nft.uid });
    await expectThrow(testEnv.wrap(updateMember)({}), WenError.nft_not_minted.key);

    await nftDocRef.update({ status: NftStatus.MINTED, available: NftAvailable.AUCTION });
    mockWalletReturnValue(walletSpy, dummyAddress, { avatarNft: nft.uid });
    await expectThrow(testEnv.wrap(updateMember)({}), WenError.nft_on_sale.key);
  });
});
