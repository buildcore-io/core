import {
  Award,
  AwardBadgeType,
  AwardDeprecated,
  AwardParticipantDeprecated,
  COL,
  SUB_COL,
  Token,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { get, isEmpty, last, set } from 'lodash';
import admin from '../../../admin.config';
import { getAwardgStorageDeposits } from '../../../services/payment/award/award-service';
import { SmrWallet } from '../../../services/wallet/SmrWalletService';
import { WalletService } from '../../../services/wallet/wallet';
import { LastDocType } from '../../../utils/common.utils';
import { xpTokenGuardianId, xpTokenId } from '../../../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../../../utils/dateTime.utils';
import { getTokenByMintId } from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';

export const awardRoll = functions
  .runWith({ maxInstances: 1, timeoutSeconds: 540, memory: '8GB' })
  .https.onRequest(async (req, res) => {
    const selectedAwards = (req.body.awards || []) as string[];
    if (selectedAwards.length > 10) {
      res.sendStatus(400);
      return;
    }

    const exisiting = await getExistingLegacyFundOrderTotals(selectedAwards);
    let amountTotal = exisiting.amountTotal;
    let totalReward = exisiting.totalReward;

    let lastDoc: LastDocType | undefined = undefined;

    const token = (await getTokenByMintId(xpTokenId()))!;
    const wallet = (await WalletService.newWallet(token.mintingData?.network)) as SmrWallet;

    const errors: { [key: string]: PromiseRejectedResult } = {};
    do {
      let query = admin.firestore().collection(COL.AWARD).limit(500);
      if (!isEmpty(selectedAwards)) {
        query = query.where(admin.firestore.FieldPath.documentId(), 'in', selectedAwards);
      }
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap = await query.get();
      lastDoc = last(snap.docs);

      const promises = snap.docs.map((doc) => rollAward(doc.id, token, wallet));
      const results = await Promise.allSettled(promises);
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          amountTotal += result.value.amount;
          totalReward += result.value.totalReward;
        } else {
          errors[snap.docs[index].id] = result;
        }
      });
    } while (lastDoc);

    const targetAddress = await wallet.getNewIotaAddressDetails();
    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: xpTokenGuardianId(),
      space: token.space,
      network: token.mintingData?.network,
      payload: {
        type: TransactionOrderType.FUND_AWARD_LEGACY,
        amount: amountTotal,
        nativeTokens: [{ id: xpTokenId(), amount: totalReward }],
        targetAddress: targetAddress.bech32,
        expiresOn: dateToTimestamp(dayjs().add(1, 'd')),
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        reconciled: false,
        void: false,
        awards: selectedAwards,
      },
    };
    const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
    await orderDocRef.create(cOn(order));

    if (errors.length) {
      functions.logger.error(JSON.stringify(errors));
    }
    res.send({ order, errors });
  });

const getExistingLegacyFundOrderTotals = async (selectedAwards: string[]) => {
  let lastDoc: LastDocType | undefined = undefined;

  let amountTotal = 0;
  let totalReward = 0;

  do {
    let query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionOrderType.FUND_AWARD)
      .where('payload.isLegacyAward', '==', true)
      .where('payload.reconciled', '==', false)
      .limit(500);
    if (!isEmpty(selectedAwards)) {
      query = query.where('payload.award', 'in', selectedAwards);
    }
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    snap.docs.forEach((doc) => {
      const order = doc.data() as Transaction;
      if (order.payload.reconciled) {
        return;
      }
      amountTotal += order.payload.amount;
      totalReward += order.payload.nativeTokens[0].amount;
    });
  } while (lastDoc);
  return { amountTotal, totalReward };
};

const rollAward = (awardId: string, token: Token, wallet: SmrWallet) =>
  admin.firestore().runTransaction(async (transaction) => {
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${awardId}`);
    const awardDep = <AwardDeprecated>(await awardDocRef.get()).data();

    if (awardDep.type === undefined || awardDep.rejected) {
      return { amount: 0, totalReward: 0 };
    }
    const award = await getUpdatedAward(awardDep, token, wallet);

    const amount =
      award.aliasStorageDeposit +
      award.collectionStorageDeposit +
      award.nttStorageDeposit +
      award.nativeTokenStorageDeposit;
    const totalReward = award.badge.total * award.badge.tokenReward;

    if (!award.rejected) {
      const targetAddress = await wallet.getNewIotaAddressDetails();
      const order = <Transaction>{
        type: TransactionType.ORDER,
        uid: getRandomEthAddress(),
        member: xpTokenGuardianId(),
        space: award.space,
        network: award.network,
        payload: {
          type: TransactionOrderType.FUND_AWARD,
          amount,
          nativeTokens: [{ id: award.badge.tokenId, amount: totalReward }],
          targetAddress: targetAddress.bech32,
          expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
          validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
          reconciled: false,
          void: false,
          award: award.uid,
          isLegacyAward: true,
        },
      };
      const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
      transaction.create(orderDocRef, cOn(order));
    }

    transaction.set(awardDocRef, uOn(award), { merge: true });

    await updateAwardParticipants(award.uid);

    return { amount, totalReward };
  });

const getUpdatedAward = async (awardDep: AwardDeprecated, token: Token, wallet: SmrWallet) => {
  const completed = get(awardDep, 'completed', false);
  const maxNttToMint = Math.min(awardDep.badge.count, Math.floor(awardDep.issued * 1.2));

  const award = {
    uid: awardDep.uid,
    createdOn: awardDep.createdOn || serverTime(),
    createdBy: awardDep.createdBy || '',
    wenUrl: awardDep.wenUrl || '',

    name: awardDep.name,
    description: awardDep.description,
    space: awardDep.space,
    endDate: awardDep.endDate,
    badge: {
      name: awardDep.badge.name,
      description: awardDep.badge.description,
      total: maxNttToMint || awardDep.badge.count,
      type: AwardBadgeType.NATIVE,

      tokenReward: awardDep.badge.xp * XP_TO_SHIMMER,
      tokenUid: token.uid,
      tokenId: token.mintingData?.tokenId,
      tokenSymbol: token.symbol,
      lockTime: 31557600000,

      image: get(awardDep, 'badge.image', null),
      ipfsMedia: get(awardDep, 'badge.ipfsMedia', null),
      ipfsMetadata: get(awardDep, 'badge.ipfsMetadata', null),
      ipfsRoot: get(awardDep, 'badge.ipfsRoot', null),
    },
    issued: awardDep.issued,
    badgesMinted: 0,
    approved: false,
    rejected: maxNttToMint === 0,
    completed,
    network: token.mintingData?.network!,
    funded: false,
    fundedBy: '',
    airdropClaimed: 0,
    isLegacy: true,
  };
  set(award, 'type', admin.firestore.FieldValue.delete());
  const storageDeposits = await getAwardgStorageDeposits(award as Award, token, wallet);

  return { ...award, ...storageDeposits };
};

const updateAwardParticipants = async (awardId: string) => {
  const participantsSnap = await admin
    .firestore()
    .doc(`${COL.AWARD}/${awardId}`)
    .collection(SUB_COL.PARTICIPANTS)
    .get();
  const promises = participantsSnap.docs.map((doc) => {
    const pariticipant = doc.data() as AwardParticipantDeprecated;
    const tokenReward = (pariticipant.xp || get(pariticipant, 'tokenReward', 0)) * XP_TO_SHIMMER;
    return doc.ref.update(uOn({ xp: admin.firestore.FieldValue.delete(), tokenReward }));
  });
  await Promise.all(promises);
};
export const XP_TO_SHIMMER = 1000000;
