import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  Nft,
  NftAvailable,
  NftStatus,
  SOON_PROJECT_ID,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../set-up';
import { expectThrow } from './common';

describe('Member control - create', () => {
  it('successfully create member', async () => {
    const uid = await testEnv.createMember();
    const memberDocRef = build5Db().doc(COL.MEMBER, uid);
    const member = await memberDocRef.get();
    expect(member?.uid).toEqual(uid.toLowerCase());
    expect(member?.createdOn).toBeDefined();
    expect(member?.updatedOn).toBeDefined();
  });
});

describe('Member control - update', () => {
  let member: string;
  beforeEach(async () => {
    member = await testEnv.createMember();
  });

  it('successfully update member', async () => {
    const updateParams = {
      name: getRandomEthAddress(),
      about: 'He rocks',
      discord: 'adamkun#1233',
      twitter: 'asdasd',
      github: 'asdasda',
    };
    mockWalletReturnValue(member, updateParams);
    const updated = await testEnv.wrap<Member>(WEN_FUNC.updateMember);
    expect(updated.name).toEqual(updateParams.name);
    expect(updated.about).toEqual(updateParams.about);
    expect(updated.discord).toEqual(updateParams.discord);
    expect(updated.twitter).toEqual(updateParams.twitter);
    expect(updated.github).toEqual(updateParams.github);
  });

  it('fail to update member username exists already', async () => {
    const updateParams = { name: 'abcd' + Math.floor(Math.random() * 1000) };
    mockWalletReturnValue(member, updateParams);
    const updated = await testEnv.wrap<Member>(WEN_FUNC.updateMember);
    expect(updated.name).toEqual(updateParams.name);
    const member2 = await testEnv.createMember();
    mockWalletReturnValue(member2, updateParams);
    const call = testEnv.wrap<Member>(WEN_FUNC.updateMember);
    await expectThrow(call, WenError.member_username_exists.key);
  });

  it('unset discord', async () => {
    const updateParams = { discord: undefined };
    mockWalletReturnValue(member, updateParams);
    const updated = await testEnv.wrap<Member>(WEN_FUNC.updateMember);
    expect(updated?.discord).toBe('');
  });

  it('Should set nft as avatar, then unset', async () => {
    const nft = {
      name: 'mynft',
      description: 'description',
      project: SOON_PROJECT_ID,
      uid: getRandomEthAddress(),
      media: MEDIA,
      owner: member,
      status: NftStatus.MINTED,
      available: NftAvailable.UNAVAILABLE,
    } as Nft;
    const nftDocRef = build5Db().doc(COL.NFT, nft.uid);
    await nftDocRef.create(nft);
    const updateParams = { avatarNft: nft.uid };
    mockWalletReturnValue(member, updateParams);
    let updated = await testEnv.wrap<Member>(WEN_FUNC.updateMember);
    expect(updated.avatarNft).toBe(nft.uid);
    expect(updated.avatar).toBe(MEDIA);
    let nftData = await nftDocRef.get();
    expect(nftData?.setAsAvatar).toBe(true);
    mockWalletReturnValue(member, { avatarNft: undefined });
    updated = await testEnv.wrap<Member>(WEN_FUNC.updateMember);
    expect(updated.avatarNft).toBe('');
    expect(updated.avatar).toBe('');
    nftData = await nftDocRef.get();
    expect(nftData?.setAsAvatar).toBe(false);
  });

  it('Should set nft as avatar, when available field is missing', async () => {
    const nft = {
      project: SOON_PROJECT_ID,
      uid: getRandomEthAddress(),
      media: MEDIA,
      owner: member,
      status: NftStatus.MINTED,
    } as Nft;
    const nftDocRef = build5Db().doc(COL.NFT, nft.uid);
    await nftDocRef.create(nft);
    const updateParams = { avatarNft: nft.uid };
    mockWalletReturnValue(member, updateParams);
    const updated = await testEnv.wrap<Member>(WEN_FUNC.updateMember);
    expect(updated.avatarNft).toBe(nft.uid);
    expect(updated.avatar).toBe(MEDIA);
  });

  it('Should throw, invalid nft not nft owner', async () => {
    mockWalletReturnValue(member, {
      avatarNft: getRandomEthAddress(),
    });
    let call = testEnv.wrap<Member>(WEN_FUNC.updateMember);
    await expectThrow(call, WenError.nft_does_not_exists.key);
    const nft = { project: SOON_PROJECT_ID, uid: getRandomEthAddress(), media: MEDIA } as Nft;
    const nftDocRef = build5Db().doc(COL.NFT, nft.uid);
    await nftDocRef.create(nft);
    mockWalletReturnValue(member, { avatarNft: nft.uid });
    call = testEnv.wrap<Member>(WEN_FUNC.updateMember);
    await expectThrow(call, WenError.you_must_be_the_owner_of_nft.key);
    await nftDocRef.update({ status: NftStatus.WITHDRAWN, owner: member });
    mockWalletReturnValue(member, { avatarNft: nft.uid });
    call = testEnv.wrap<Member>(WEN_FUNC.updateMember);
    await expectThrow(call, WenError.nft_not_minted.key);
    await nftDocRef.update({ status: NftStatus.MINTED, available: NftAvailable.AUCTION });
    mockWalletReturnValue(member, { avatarNft: nft.uid });
    call = testEnv.wrap<Member>(WEN_FUNC.updateMember);
    await expectThrow(call, WenError.nft_on_sale.key);
  });
});
