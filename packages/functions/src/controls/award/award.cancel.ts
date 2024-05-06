import { database } from '@buildcore/database';
import { Award, AwardCancelRequest, COL, WenError } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const cancelAwardControl = ({
  owner,
  params,
}: Context<AwardCancelRequest>): Promise<Award> =>
  database().runTransaction(async (transaction) => {
    const awardDocRef = database().doc(COL.AWARD, params.uid);
    const award = await transaction.get(awardDocRef);

    if (!award) {
      throw invalidArgument(WenError.award_does_not_exists);
    }
    if (award.completed) {
      throw invalidArgument(WenError.award_is_no_longer_available);
    }
    if (dayjs(award.endDate.toDate()).isBefore(dayjs())) {
      throw invalidArgument(WenError.award_is_no_longer_available);
    }

    await assertIsGuardian(award.space, owner);

    const data = { uid: award.uid, completed: true };
    await transaction.update(awardDocRef, data);

    return { ...award, ...data };
  });
