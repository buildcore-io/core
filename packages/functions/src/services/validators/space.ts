import { DEFAULT_NETWORK, Space, SUB_COL, WenError } from '@soon/interfaces';
import admin from '../../admin.config';
import { assertSpaceHasValidAddress } from '../../utils/address.utils';
import { throwInvalidArgument } from '../../utils/error.utils';

type DocRefType = admin.firestore.DocumentReference<admin.firestore.DocumentData>;

export class SpaceValidator {
  public static async spaceExists(refSpace: DocRefType): Promise<void> {
    if (!(await refSpace.get()).exists) {
      throw throwInvalidArgument(WenError.space_does_not_exists);
    }
  }

  public static async isGuardian(refSpace: DocRefType, guardian: string): Promise<void> {
    if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
      throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
    }
  }

  public static async hasValidAddress(refSpace: DocRefType): Promise<void> {
    const space = <Space | undefined>(await refSpace.get()).data();
    assertSpaceHasValidAddress(space, DEFAULT_NETWORK);
  }
}