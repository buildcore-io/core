import { COL, Member, Nft, NftAvailable, NftStatus, WenError } from '@build5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { invalidArgument } from '../../utils/error.utils';
import { cleanupParams } from '../../utils/schema.utils';

export const updateMemberControl = async (owner: string, params: Record<string, unknown>) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  if (params.name) {
    const members = await soonDb()
      .collection(COL.MEMBER)
      .where('name', '==', params.name)
      .where('uid', '!=', owner)
      .get();
    if (members.length > 0) {
      throw invalidArgument(WenError.member_username_exists);
    }
  }

  const batch = soonDb().batch();

  if (params.avatarNft) {
    const nft = await getNft(owner, params.avatarNft as string);
    params.avatar = nft.media;

    const nftDocRef = soonDb().doc(`${COL.NFT}/${params.avatarNft}`);
    batch.update(nftDocRef, { setAsAvatar: true });
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
    throw invalidArgument(WenError.nft_does_not_exists);
  }
  if (nft.owner !== owner) {
    throw invalidArgument(WenError.you_must_be_the_owner_of_nft);
  }
  if (nft.status !== NftStatus.MINTED) {
    throw invalidArgument(WenError.nft_not_minted);
  }
  if (nft.available !== undefined && nft.available !== NftAvailable.UNAVAILABLE) {
    throw invalidArgument(WenError.nft_on_sale);
  }
  return nft;
};
