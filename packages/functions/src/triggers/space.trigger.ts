import { COL, MediaStatus, Space } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { downloadMediaAndPackCar, putCar } from '../utils/car.utils';
import { uOn } from '../utils/dateTime.utils';

export const spaceUpdateTrigger = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '512MB',
  })
  .firestore.document(COL.SPACE + '/{spaceId}')
  .onUpdate(async (change) => {
    const prev = <Space | undefined>change.before.data();
    const curr = <Space | undefined>change.after.data();
    if (!curr) {
      return;
    }
    if (
      curr.bannerUrl &&
      prev?.mediaStatus !== curr.mediaStatus &&
      curr.mediaStatus === MediaStatus.PREPARE_IPFS
    ) {
      const { car, ...ipfs } = await downloadMediaAndPackCar(curr.uid, curr.bannerUrl, curr);
      await putCar(car);
      await change.after.ref.update(uOn({ ...ipfs, mediaStatus: MediaStatus.PENDING_UPLOAD }));
    }
  });
