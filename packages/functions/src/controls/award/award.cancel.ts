import { Award, COL, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../firebase/firestore/soondb';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const cancelAwardControl = (owner: string, params: Record<string, unknown>) =>
  soonDb().runTransaction(async (transaction) => {
    const awardDocRef = soonDb().doc(`${COL.AWARD}/${params.uid}`);
    const award = await transaction.get<Award>(awardDocRef);

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
    transaction.update(awardDocRef, data);
  });
