import {
  Award,
  AwardBadge,
  AwardBadgeDeprecated,
  AwardBadgeType,
  AwardDeprecated,
  COL,
  MediaStatus,
  Network,
  Transaction,
  TransactionOrderType,
  TransactionType,
} from '@soonaverse/interfaces';
import { get } from 'lodash';
import admin from '../../src/admin.config';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { awardRoll, XP_TO_SHIMMER } from '../../src/firebase/functions/dbRoll/award.roll';
import { xpTokenGuardianId, xpTokenId, xpTokenUid } from '../../src/utils/config.utils';
import { fullyCompletedAward, halfCompletedAward, Helper, newAward } from './Helper';

describe('Award roll test', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.clearDb();
    await helper.beforeEach();
  });

  it('Should roll award and upload ipfs', async () => {
    const legacyAward = newAward(helper.space.uid);
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);

    const req = { body: {} } as any;
    const res = { send: () => {} } as any;
    await awardRoll(req, res);
    await uploadMediaToWeb3();

    const migratedAward = <Award>(await awardDocRef.get()).data();
    assertMigratedAward(migratedAward, legacyAward as any, MediaStatus.UPLOADED);
  });

  it.each([newAward, halfCompletedAward, fullyCompletedAward])(
    'Should roll award',
    async (func: (space: string) => any) => {
      const legacyAward = func(helper.space.uid);
      const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
      await awardDocRef.create(legacyAward);

      const req = { body: {} } as any;
      const res = { send: () => {} } as any;
      await awardRoll(req, res);

      const migratedAward = <Award>(await awardDocRef.get()).data();
      assertMigratedAward(migratedAward, legacyAward as any);
    },
  );

  const createAndSaveAward = async (func: (space: string) => any) => {
    const legacyAward = func(helper.space.uid);
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);
    return legacyAward;
  };

  it('Should only roll specific award', async () => {
    let award1 = await createAndSaveAward(newAward);
    let award2 = await createAndSaveAward(halfCompletedAward);

    const req = { body: { awards: [award2.uid] } } as any;
    const res = { send: () => {} } as any;
    await awardRoll(req, res);

    const award1DocRef = admin.firestore().doc(`${COL.AWARD}/${award1.uid}`);
    award1 = (await award1DocRef.get()).data();
    expect(award1.type).toBeDefined();

    const award2DocRef = admin.firestore().doc(`${COL.AWARD}/${award2.uid}`);
    award2 = (await award2DocRef.get()).data();
    expect(award2.isLegacy).toBe(true);
  });

  it('Should roll award', async () => {
    const awards = [
      await createAndSaveAward(newAward),
      await createAndSaveAward(halfCompletedAward),
      await createAndSaveAward(halfCompletedAward),
    ];

    let order: Transaction = {} as any;
    const req = { body: {} } as any;
    const res = {
      send: (response: Transaction) => {
        order = response;
      },
    } as any;
    await awardRoll(req, res);
    await awardRoll(req, res);

    const promises = awards.map(async (award) => {
      const docRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
      return <Award>(await docRef.get()).data();
    });
    const migratedAwards = await Promise.all(promises);
    migratedAwards.forEach(assertAwardFundOrder);
    const totalAmount = migratedAwards.reduce(
      (sum, award) =>
        sum +
        award.aliasStorageDeposit +
        award.collectionStorageDeposit +
        award.nttStorageDeposit +
        award.nativeTokenStorageDeposit,
      0,
    );
    const totalReward = migratedAwards.reduce(
      (sum, act) => sum + act.badge.tokenReward * act.badge.total,
      0,
    );
    expect(order.payload.amount).toBe(totalAmount);
    expect(order.payload.nativeTokens[0].amount).toBe(totalReward);
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
  expect(award.rejected).toBe(legacyAward.rejected);
  expect(award.completed).toBe(get(legacyAward, 'completed'));
  expect(award.rejected).toBe(legacyAward.rejected);
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
  const order = <Transaction>ordersSnap.docs[0].data();
  expect(order.type).toBe(TransactionType.ORDER);
  expect(order.member).toBe(xpTokenGuardianId());
  expect(order.space).toBe(award.space);
  expect(order.network).toBe(Network.RMS);
  expect(order.payload.type).toBe(TransactionOrderType.FUND_AWARD);
  expect(order.payload.amount).toBe(
    award.aliasStorageDeposit +
      award.collectionStorageDeposit +
      award.nttStorageDeposit +
      award.nativeTokenStorageDeposit,
  );
  expect(order.payload.nativeTokens[0].id).toBe(xpTokenId());
  expect(order.payload.nativeTokens[0].amount).toBe(award.badge.tokenReward * award.badge.total);
};
