import { COL, FileMetedata, Member, WenError } from '@soonaverse/interfaces';
import { get } from 'lodash';
import { soonDb } from '../../database/wrapper/soondb';
import { updateMemberSchema } from '../../runtime/firebase/member';
import { throwInvalidArgument } from '../../utils/error.utils';
import { pSchema } from '../../utils/schema.utils';

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

  // TODO Add validation via SC they really own the NFT.
  if (params.currentProfileImage) {
    const avatar = await soonDb()
      .collection(COL.AVATARS)
      .doc((params.currentProfileImage as FileMetedata).metadata)
      .get();
    if (!avatar) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }

    if (!get(avatar, 'available')) {
      throw throwInvalidArgument(WenError.nft_is_no_longer_available);
    }
  }

  if (params) {
    await memberDocRef.update(pSchema(updateMemberSchema, params, ['currentProfileImage']));

    if (params.currentProfileImage) {
      await soonDb()
        .collection(COL.AVATARS)
        .doc((params.currentProfileImage as FileMetedata).metadata)
        .update({ available: false });
    }
  }

  return await memberDocRef.get<Member>();
};
