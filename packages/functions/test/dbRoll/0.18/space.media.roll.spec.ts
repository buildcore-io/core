import { COL, MediaStatus, Space } from '@soonaverse/interfaces';
import { isEmpty } from 'lodash';
import { setMediaStatusOnSpaces } from '../../../scripts/dbUpgrades/0_18/space.media.roll';
import admin from '../../../src/admin.config';
import { uploadMediaToWeb3 } from '../../../src/cron/media.cron';
import * as wallet from '../../../src/utils/wallet.utils';
import { createMember, wait } from '../../controls/common';
import { MEDIA } from '../../set-up';

let walletSpy: any;

describe('Space media roll', () => {
  let member: string;
  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
  });

  it('Should set space media', async () => {
    const count = 10;
    const promises = Array.from(Array(count)).map(async (_, index) => {
      const space = {
        uid: wallet.getRandomEthAddress(),
        name: 'space' + index,
        bannerUrl: MEDIA,
        createdBy: member,
      };
      await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).create(space);
      return space;
    });
    await Promise.all(promises);

    await setMediaStatusOnSpaces(admin.app());

    const spaceQuery = admin.firestore().collection(COL.SPACE).where('createdBy', '==', member);
    await wait(async () => {
      const snap = await spaceQuery.get();
      const allSet = snap.docs.reduce((acc, doc) => {
        const space = doc.data() as Space;
        return (
          acc &&
          space.mediaStatus === MediaStatus.PENDING_UPLOAD &&
          !isEmpty(space.ipfsMedia) &&
          !isEmpty(space.ipfsMetadata) &&
          !isEmpty(space.ipfsRoot)
        );
      }, true);
      return allSet;
    });

    await uploadMediaToWeb3();

    await wait(async () => {
      const snap = await spaceQuery.get();
      const allSet = snap.docs.reduce((acc, doc) => {
        const space = doc.data() as Space;
        return acc && space.mediaStatus === MediaStatus.UPLOADED;
      }, true);
      return allSet;
    });
  });
});
