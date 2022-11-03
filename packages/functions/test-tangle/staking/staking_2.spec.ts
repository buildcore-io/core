import {
  IMetadataFeature,
  METADATA_FEATURE_TYPE,
  TIMELOCK_UNLOCK_CONDITION_TYPE,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import { COL, StakeType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { Helper } from './Helper';

describe('Staking test', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should stake with metadata', async () => {
    const type = StakeType.DYNAMIC;
    const customMetadata = {
      name: 'random name',
      asd: 'true',
    };
    await helper.stakeAmount(10, 26, undefined, type, customMetadata);
    await helper.validateStatsStakeAmount(10, 10, 15, 15, type);
    await helper.validateMemberStakeAmount(10, 10, 15, 15, type);

    const outputs = await helper.walletService!.getOutputs(
      helper.memberAddress!.bech32,
      [],
      false,
      true,
    );
    expect(Object.keys(outputs).length).toBe(1);

    const hexMetadata = <IMetadataFeature>(
      Object.values(outputs)[0].features?.find((t) => t.type === METADATA_FEATURE_TYPE)!
    );
    const decoded = JSON.parse(Converter.hexToUtf8(hexMetadata.data));
    expect(decoded.name).toBe(customMetadata.name);
    expect(decoded.asd).toBe(customMetadata.asd);
  });

  it.each([StakeType.DYNAMIC, StakeType.STATIC])(
    'Should set take amount and remove it once expired, 52 weeks',
    async (type: StakeType) => {
      const stake1 = await helper.stakeAmount(10, 52, undefined, type);
      await helper.validateStatsStakeAmount(10, 10, 20, 20, type);
      await helper.validateMemberStakeAmount(10, 10, 20, 20, type);

      const stake2 = await helper.stakeAmount(20, 52, undefined, type);
      await helper.validateStatsStakeAmount(30, 30, 60, 60, type);
      await helper.validateMemberStakeAmount(30, 30, 60, 60, type);

      await removeExpiredStakesFromSpace();
      await helper.validateStatsStakeAmount(30, 30, 60, 60, type);
      await helper.validateMemberStakeAmount(30, 30, 60, 60, type);

      await admin
        .firestore()
        .doc(`${COL.STAKE}/${stake2.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
      await removeExpiredStakesFromSpace();
      await helper.validateStatsStakeAmount(10, 30, 20, 60, type);
      await helper.validateMemberStakeAmount(10, 30, 20, 60, type);

      await admin
        .firestore()
        .doc(`${COL.STAKE}/${stake1.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
      await removeExpiredStakesFromSpace();
      await helper.validateStatsStakeAmount(0, 30, 0, 60, type);
      await helper.validateMemberStakeAmount(0, 30, 0, 60, type);

      const outputs = await helper.walletService!.getOutputs(
        helper.memberAddress!.bech32,
        [],
        false,
        true,
      );
      expect(Object.keys(outputs).length).toBe(2);
      const hasTimelock = Object.values(outputs).filter(
        (o) =>
          o.unlockConditions.find((u) => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE) !== undefined,
      );
      expect(hasTimelock.length).toBe(2);
    },
  );

  afterAll(async () => {
    await helper.listenerRMS!.cancel();
  });
});
