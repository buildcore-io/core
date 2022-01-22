import { SUB_COL } from "../../../interfaces/models/base";
import { throwInvalidArgument } from "../../utils/error.utils";
import { WenError } from './../../../interfaces/errors';

export class SpaceValidator {
  public static async spaceExists(refSpace: any): Promise<void> {
    if (!(await refSpace.get()).exists) {
      throw throwInvalidArgument(WenError.space_does_not_exists);
    }
  }

  public static async isGuardian(refSpace: any, guardian: string): Promise<void> {
    if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
      throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
    }
  }
}
