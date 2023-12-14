import { build5Db } from '@build-5/database';
import { COL, Network, SUB_COL, StampRequest } from '@build-5/interfaces';
import { createStampAndStampOrder } from '../../services/payment/tangle-service/stamp/StampTangleService';
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

  const batch = build5Db().batch();

  if (!params.aliasId) {
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
    batch.create(spaceDocRef, space);

    const guardian = { uid: owner, parentId: space.uid, parentCol: COL.SPACE };
    const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
    batch.create(guardianDocRef, guardian);

    const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
    batch.create(memberDocRef, guardian);
  }

  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  batch.create(orderDocRef, order);

  const stampDocRef = build5Db().doc(`${COL.STAMP}/${stamp.uid}`);
  batch.create(stampDocRef, stamp);

  await batch.commit();

  return order;
};
