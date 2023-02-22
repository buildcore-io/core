import {
  Award,
  AwardBadge,
  AwardBadgeDeprecated,
  AwardBadgeType,
  AwardDeprecated,
  COL,
  MediaStatus,
  TransactionOrderType,
} from '@soonaverse/interfaces';
import { get } from 'lodash';
import { awardImageMigration } from '../../scripts/dbUpgrades/0_18/award.image.migration';
import admin from '../../src/admin.config';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { awardRoll, XP_TO_SHIMMER } from '../../src/firebase/functions/dbRoll/award.roll';
import { xpTokenId, xpTokenUid } from '../../src/utils/config.utils';
import { Helper } from './Helper';

describe('Award roll test', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.clearDb();
    await helper.beforeEach();
  });

  it('Should roll award and upload ipfs', async () => {
    const legacyAward = helper.newAward();
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);

    await awardImageMigration(admin.app());

    const req = { body: {} } as any;
    const res = { send: () => {} } as any;
    await awardRoll(req, res);
    await uploadMediaToWeb3();

    const migratedAward = <Award>(await awardDocRef.get()).data();
    assertMigratedAward(migratedAward, legacyAward as any, MediaStatus.UPLOADED);
  });
});

const assertMigratedAward = (
  award: Award,
  legacyAward: AwardDeprecated,
  mediaStatus = MediaStatus.PENDING_UPLOAD,
) => {
  expect(award.name).toBe(legacyAward.name);
  expect(award.description).toBe(legacyAward.description);
  expect(award.space).toBe(legacyAward.space);
  expect(award.endDate.seconds).toEqual(legacyAward.endDate.seconds);
  expect(award.issued).toBe(legacyAward.issued);
  expect(award.badgesMinted).toBe(0);
  expect(award.approved).toBe(false);
  expect(award.rejected).toBe(legacyAward.issued === 0);
  expect(award.completed).toBe(get(legacyAward, 'completed'));
  expect(award.aliasStorageDeposit).toBe(53700);
  expect(award.collectionStorageDeposit).toBe(76800);
  expect(award.nttStorageDeposit).toBe(1254000);
  expect(award.nativeTokenStorageDeposit).toBe(49600);
  expect(award.funded).toBe(false);
  expect(award.fundedBy).toBe('');
  expect(award.mediaStatus).toBe(mediaStatus);
  expect(award.isLegacy).toBe(true);
  expect(get(award, 'type')).toBeUndefined();

  assertMigratedBage(award.badge, legacyAward.badge);
  assertAwardFundOrder(award);
};

const assertMigratedBage = (badge: AwardBadge, legacyBadge: AwardBadgeDeprecated) => {
  expect(badge.name).toBe(legacyBadge.name);
  expect(badge.description).toBe(legacyBadge.description);
  expect(badge.total).toBe(legacyBadge.count);
  expect(badge.type).toBe(AwardBadgeType.NATIVE);
  expect(badge.name).toBe(legacyBadge.name);
  expect(badge.tokenReward).toBe(legacyBadge.xp * XP_TO_SHIMMER);
  expect(badge.tokenUid).toBe(xpTokenUid());
  expect(badge.tokenId).toBe(xpTokenId());
  expect(badge.tokenSymbol).toBe('XPT');

  expect(badge.image).toBeDefined();
  expect(badge.ipfsMedia).toBeDefined();
  expect(badge.ipfsMetadata).toBeDefined();
  expect(badge.ipfsRoot).toBeDefined();
};

const assertAwardFundOrder = async (award: Award) => {
  const ordersSnap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', award.uid)
    .where('payload.type', '==', TransactionOrderType.FUND_AWARD)
    .get();
  expect(ordersSnap.size).toBe(0);
};
