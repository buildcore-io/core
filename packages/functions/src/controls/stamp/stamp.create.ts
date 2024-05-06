import { database } from '@buildcore/database';
import { COL, Network, SUB_COL, StampRequest } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { createStampAndStampOrder } from '../../services/payment/tangle-service/stamp/StampTangleService';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { Context } from '../common';

export const stampCreateControl = async ({ project, owner, params }: Context<StampRequest>) => {
  const { order, stamp, space } = await createStampAndStampOrder(
    project,
    owner,
    params.network as Network,
    params.file,
    undefined,
    params.aliasId,
  );

  const batch = database().batch();

  if (!params.aliasId) {
    const spaceDocRef = database().doc(COL.SPACE, space.uid);
    batch.create(spaceDocRef, space);

    const guardian = {
      uid: owner,
      parentId: space.uid,
      parentCol: COL.SPACE,
      createdOn: dateToTimestamp(dayjs()),
    };
    const guardianDocRef = database().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner);
    batch.create(guardianDocRef, guardian);

    const memberDocRef = database().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner);
    batch.create(memberDocRef, guardian);
  }

  const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
  batch.create(orderDocRef, order);

  const stampDocRef = database().doc(COL.STAMP, stamp.uid);
  batch.create(stampDocRef, stamp);

  await batch.commit();

  return order;
};
