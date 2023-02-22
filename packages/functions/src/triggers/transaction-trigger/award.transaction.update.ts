import { TransactionHelper } from '@iota/iota.js-next';
import {
  Award,
  AwardParticipant,
  COL,
  Member,
  SUB_COL,
  TokenDropStatus,
  Transaction,
  TransactionAwardType,
  TransactionIgnoreWalletReason,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty, last } from 'lodash';
import admin, { inc } from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { indexToString } from '../../utils/block.utils';
import { LastDocType } from '../../utils/common.utils';
import { cOn, dateToTimestamp, uOn } from '../../utils/dateTime.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onAwardUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
    case TransactionAwardType.MINT_ALIAS: {
      await onAliasMinted(transaction);
      break;
    }
    case TransactionAwardType.MINT_COLLECTION: {
      await onCollectionMinted(transaction);
      break;
    }
    case TransactionAwardType.BADGE: {
      await onBadgeMinted(transaction);
      break;
    }
  }
};

const onAliasMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;
  const aliasOutputId = getTransactionPayloadHex(milestoneTransaction.payload) + indexToString(0);

  const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${transaction.payload.award}`);
  await awardDocRef.update(
    uOn({
      aliasBlockId: milestoneTransaction.blockId,
      aliasId: TransactionHelper.resolveIdFromOutputId(aliasOutputId),
    }),
  );

  const order = <Transaction>{
    type: TransactionType.AWARD,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionAwardType.MINT_COLLECTION,
      sourceAddress: transaction.payload.sourceAddress,
      award: transaction.payload.award,
    },
  };
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;
  const collectionOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload) + indexToString(1);

  const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${transaction.payload.award}`);

  const award = <Award>(await awardDocRef.get()).data();
  if (award.isLegacy) {
    await updateParticipantsBadgesAndAirdrops(award);
  }

  await awardDocRef.update(
    uOn({
      collectionBlockId: milestoneTransaction.blockId,
      collectionId: TransactionHelper.resolveIdFromOutputId(collectionOutputId),
      approved: true,
      rejected: false,
    }),
  );
};

const onBadgeMinted = async (transaction: Transaction) =>
  admin
    .firestore()
    .doc(`${COL.AWARD}/${transaction.payload.award}`)
    .update(uOn({ badgesMinted: inc(1) }));

const updateParticipantsBadgesAndAirdrops = async (award: Award) => {
  if (!award.badge.tokenReward) {
    return;
  }

  let lastDoc: LastDocType | undefined;
  const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);

  do {
    let query = awardDocRef.collection(SUB_COL.PARTICIPANTS).limit(200);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map(async (doc) => updateParticipantBadgesAndAirdrops(doc, award));
    await Promise.all(promises);
  } while (lastDoc);
};

const updateParticipantBadgesAndAirdrops = async (
  doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>,
  award: Award,
) => {
  const participant = doc.data() as AwardParticipant;
  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${participant.uid}`);
  const member = <Member | undefined>(await memberDocRef.get()).data();
  const memberAddress = getAddress(member, award.network) || '';

  const airdrops = Array.from(Array(participant.count)).map(() => ({
    createdBy: award.fundedBy,
    uid: getRandomEthAddress(),
    member: participant.uid,
    token: award.badge.tokenUid,
    award: award.uid,
    vestingAt: dateToTimestamp(dayjs()),
    count: award.badge.tokenReward,
    status: TokenDropStatus.UNCLAIMED,
    sourceAddress: award.address,
    isBaseToken: false,
  }));
  for (const airdrop of airdrops) {
    const airdropDocRef = admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`);
    await airdropDocRef.create(cOn(airdrop));
  }

  const tokendDocRef = admin.firestore().doc(`${COL.TOKEN}/${award.badge.tokenUid}`);
  const distributionDocRef = tokendDocRef.collection(SUB_COL.DISTRIBUTION).doc(participant.uid);
  distributionDocRef.set(
    uOn({
      parentId: award.badge.tokenUid,
      parentCol: COL.TOKEN,
      uid: participant.uid,
      totalUnclaimedAirdrop: inc(participant.count * award.badge.tokenReward),
    }),
    { merge: true },
  );

  const badgesSnap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('type', '==', 'BADGE')
    .where('member', '==', participant.uid)
    .where('payload.award', '==', award.uid)
    .get();

  for (let edition = 0; edition < badgesSnap.docs.length; ++edition) {
    const badgeDoc = badgesSnap.docs[edition];
    await badgeDoc.ref.update(
      uOn({
        type: TransactionType.AWARD,
        uid: badgeDoc.id,
        member: participant.uid,
        space: award.space,
        network: award.network,
        ignoreWallet: isEmpty(memberAddress),
        ignoreWalletReason: isEmpty(memberAddress)
          ? TransactionIgnoreWalletReason.MISSING_TARGET_ADDRESS
          : null,
        payload: {
          type: TransactionAwardType.BADGE,
          sourceAddress: award.address,
          targetAddress: memberAddress,
          award: award.uid,
          tokenReward: award.badge.tokenReward,
          edition: edition + 1,
          participatedOn: participant?.createdOn || dateToTimestamp(dayjs()),
        },
        shouldRetry: !isEmpty(memberAddress),
      }),
    );
  }
};
