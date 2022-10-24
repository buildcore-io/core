import { Access, COL, SUB_COL, TransactionType, WenError } from '@soon/interfaces';
import admin from '../../admin.config';
import { throwInvalidArgument } from '../../utils/error.utils';

export const assertHasAccess = async (
  spaceId: string,
  member: string | undefined,
  access: Access,
  accessAwards: string[],
  accessCollections: string[],
) => {
  if (access === Access.OPEN) {
    return;
  }

  if (access === Access.MEMBERS_ONLY) {
    if (
      !(await admin.firestore().doc(`${COL.SPACE}/${spaceId}/${SUB_COL.MEMBERS}/${member}`).get())
        .exists
    ) {
      throw throwInvalidArgument(WenError.you_are_not_part_of_space);
    }
  }

  if (access === Access.GUARDIANS_ONLY) {
    if (
      !(await admin.firestore().doc(`${COL.SPACE}/${spaceId}/${SUB_COL.GUARDIANS}/${member}`).get())
        .exists
    ) {
      throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
    }
  }

  if (access === Access.MEMBERS_WITH_BADGE) {
    const includedBadges: string[] = [];
    const snapshot = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BADGE)
      .where('member', '==', member)
      .get();
    if (snapshot.size && accessAwards.length) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (
          accessAwards.includes(data.payload.award) &&
          !includedBadges.includes(data.payload.award)
        ) {
          includedBadges.push(data.payload.award);
          break;
        }
      }
    }

    if (accessAwards.length !== includedBadges.length) {
      throw throwInvalidArgument(WenError.you_dont_have_required_badge);
    }
  }

  if (access === Access.MEMBERS_WITH_NFT_FROM_COLLECTION) {
    const includedCollections: string[] = [];
    const snapshot = await admin.firestore().collection(COL.NFT).where('owner', '==', member).get();
    if (snapshot.size > 0 && accessCollections?.length) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (
          accessCollections.includes(data.collection) &&
          !includedCollections.includes(data.collection)
        ) {
          includedCollections.push(data.collection);
          break;
        }
      }
    }

    if (accessCollections.length !== includedCollections.length) {
      throw throwInvalidArgument(WenError.you_dont_have_required_NFTs);
    }
  }
};
