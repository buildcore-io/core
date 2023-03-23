import { COL, Member, Nft, NftAvailable, NftStatus, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { cleanupParams } from '../../utils/schema.utils';

export const updateMemberControl = async (owner: string, params: Record<string, unknown>) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (params.name) {
    const members = await soonDb()
      .collection(COL.MEMBER)
      .where('name', '==', params.name)
      .where('uid', '!=', owner)
      .get();
    if (members.length > 0) {
      throw throwInvalidArgument(WenError.member_username_exists);
    }
  }

  const batch = soonDb().batch();

  if (params.avatarNft) {
    const nft = await getNft(owner, params.avatarNft as string);
    params.avatar = nft.media;

    const nftDocRef = soonDb().doc(`${COL.NFT}/${params.avatarNft}`);
    batch.update(nftDocRef, uOn({ setAsAvatar: true }));
  } else if (Object.keys(params).includes('avatarNft')) {
    params.avatar = null;
  }

  if (member.avatarNft && member.avatarNft !== params.avatarNft) {
    const currentAvatarDocRef = soonDb().doc(`${COL.NFT}/${member.avatarNft}`);
    batch.update(currentAvatarDocRef, { setAsAvatar: false });
  }

  batch.update(memberDocRef, cleanupParams(params));
  await batch.commit();

  return await memberDocRef.get<Member>();
};

const getNft = async (owner: string, nftId: string) => {
  const nftDocRef = soonDb().doc(`${COL.NFT}/${nftId}`);
  const nft = await nftDocRef.get<Nft>();
  if (!nft) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }
  if (nft.owner !== owner) {
    throw throwInvalidArgument(WenError.you_must_be_the_owner_of_nft);
  }
  if (nft.status !== NftStatus.MINTED) {
    throw throwInvalidArgument(WenError.nft_not_minted);
  }
  if (nft.available !== NftAvailable.UNAVAILABLE) {
    throw throwInvalidArgument(WenError.nft_on_sale);
  }
  return nft;
};
