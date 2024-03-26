import { build5Db } from '@build-5/database';
import { COL, Space, StakeType } from '@build-5/interfaces';
import { FeatureType, MetadataFeature, UnlockConditionType, hexToUtf8 } from '@iota/sdk';
import dayjs from 'dayjs';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
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
      isOld: 'true',
    };
    await helper.stakeAmount(10, 26, undefined, type, customMetadata);
    await helper.validateStatsStakeAmount(10, 10, 14, 14, type, 1);
    await helper.validateMemberStakeAmount(10, 10, 14, 14, type);

    const outputs = await helper.walletService!.getOutputs(
      helper.memberAddress!.bech32,
      [],
      false,
      true,
    );
    expect(Object.keys(outputs).length).toBe(1);

    const hexMetadata = <MetadataFeature>(
      Object.values(outputs)[0].features?.find((t) => t.type === FeatureType.Metadata)!
    );
    const decoded = JSON.parse(hexToUtf8(hexMetadata.data));
    expect(decoded.name).toBe(customMetadata.name);
    expect(decoded.isOld).toBe(customMetadata.isOld);
  });

  it.each([StakeType.DYNAMIC, StakeType.STATIC])(
    'Should set stake amount and remove it once expired, 52 weeks',
    async (type: StakeType) => {
      const spaceDocRef = build5Db().doc(COL.SPACE, helper.space?.uid!);
      await spaceDocRef.update({ tokenBased: true, minStakedValue: 10 });
      let space = <Space>await spaceDocRef.get();
      expect(space.totalMembers).toBe(1);
      expect(space.totalGuardians).toBe(1);

      const stake1 = await helper.stakeAmount(10, 52, undefined, type);
      await helper.validateStatsStakeAmount(10, 10, 20, 20, type, 1);
      await helper.validateMemberStakeAmount(10, 10, 20, 20, type);

      const stake2 = await helper.stakeAmount(20, 52, undefined, type);
      await helper.validateStatsStakeAmount(30, 30, 60, 60, type, 1);
      await helper.validateMemberStakeAmount(30, 30, 60, 60, type);

      await removeExpiredStakesFromSpace();
      await helper.validateStatsStakeAmount(30, 30, 60, 60, type, 1);
      await helper.validateMemberStakeAmount(30, 30, 60, 60, type);

      await build5Db()
        .doc(COL.STAKE, stake2.uid)
        .update({ expiresAt: dayjs().subtract(1, 'm').toDate() });
      await removeExpiredStakesFromSpace();
      await helper.validateStatsStakeAmount(10, 30, 20, 60, type, 1);
      await helper.validateMemberStakeAmount(10, 30, 20, 60, type);

      await build5Db()
        .doc(COL.STAKE, stake1.uid)
        .update({ expiresAt: dayjs().subtract(1, 'm').toDate() });
      await removeExpiredStakesFromSpace();
      await helper.validateStatsStakeAmount(0, 30, 0, 60, type, 0);
      await helper.validateMemberStakeAmount(0, 30, 0, 60, type);

      space = <Space>await spaceDocRef.get();
      expect(space.totalMembers).toBe(1);
      expect(space.totalGuardians).toBe(1);

      const outputs = await helper.walletService!.getOutputs(
        helper.memberAddress!.bech32,
        [],
        false,
        true,
      );
      expect(Object.keys(outputs).length).toBe(2);
      const hasTimelock = Object.values(outputs).filter(
        (o) =>
          o.unlockConditions.find((u) => u.type === UnlockConditionType.Timelock) !== undefined,
      );
      expect(hasTimelock.length).toBe(2);
    },
  );
});
