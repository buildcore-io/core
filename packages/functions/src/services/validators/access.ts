import { database } from '@buildcore/database';
import { Access, COL, SUB_COL, TransactionPayloadType, WenError } from '@buildcore/interfaces';
import { invalidArgument } from '../../utils/error.utils';

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
    if (!(await database().doc(COL.SPACE, spaceId, SUB_COL.MEMBERS, member).get())) {
      throw invalidArgument(WenError.you_are_not_part_of_space);
    }
  }

  if (access === Access.GUARDIANS_ONLY) {
    if (!(await database().doc(COL.SPACE, spaceId, SUB_COL.GUARDIANS, member).get())) {
      throw invalidArgument(WenError.you_are_not_guardian_of_space);
    }
  }

  if (access === Access.MEMBERS_WITH_BADGE) {
    for (const award of accessAwards) {
      const snapshot = await database()
        .collection(COL.TRANSACTION)
        .where('payload_type', '==', TransactionPayloadType.BADGE)
        .where('member', '==', member)
        .where('payload_award', '==', award)
        .limit(1)
        .get();
      if (!snapshot.length) {
        throw invalidArgument(WenError.you_dont_have_required_badge);
      }
    }
  }

  if (access === Access.MEMBERS_WITH_NFT_FROM_COLLECTION) {
    const includedCollections: string[] = [];
    const snapshot = await database().collection(COL.NFT).where('owner', '==', member).get();
    if (snapshot.length > 0 && accessCollections?.length) {
      for (const data of snapshot) {
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
      throw invalidArgument(WenError.you_dont_have_required_NFTs);
    }
  }
};
