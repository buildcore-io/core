import {
  COL,
  Space,
  Spdr,
  SpdrStatus,
  Stake,
  SUB_COL,
  Token,
  TokenDrop,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { last } from 'lodash';
import admin from '../admin.config';
import { LastDocType } from '../utils/common.utils';
import { dateToTimestamp, uOn } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const spdrCronTask = async () => {
  const spdrs = await getDueSpdrs();

  for (const spdr of spdrs) {
    const spdrDocRef = admin.firestore().doc(`${COL.SPDR}/${spdr.uid}`);
    await spdrDocRef.update(uOn({ status: SpdrStatus.PROCESSED }));
    try {
      const { totalAirdropped, totalStaked } = await executeSpdrDistribution(spdr);
      await spdrDocRef.update(uOn({ totalStaked, totalAirdropped }));
    } catch (error) {
      functions.logger.error('SPDR error', spdr.uid, error);
      await spdrDocRef.update(uOn({ status: SpdrStatus.ERROR }));
    }
  }
};

const STAKE_QUERY_LIMT = 1000;
const executeSpdrDistribution = async (spdr: Spdr) => {
  const stakedPerMember: { [key: string]: number } = {};
  let lastDoc: LastDocType | undefined = undefined;
  do {
    let query = admin
      .firestore()
      .collection(COL.STAKE)
      .where('token', '==', spdr.token)
      .where('createdOn', '>=', spdr.startDate)
      .where('createdOn', '<', spdr.endDate)
      .orderBy('createdOn')
      .limit(STAKE_QUERY_LIMT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    snap.docs.forEach((d) => {
      const stake = <Stake>d.data();
      stakedPerMember[stake.member] = (stakedPerMember[stake.member] || 0) + stake.amount;
    });
  } while (lastDoc);

  const totalStaked = Object.values(stakedPerMember).reduce((acc, act) => acc + act, 0);

  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${spdr.token}`).get()).data();
  const totalAirdropped = await createAirdrops(token, spdr, totalStaked, stakedPerMember);
  return { totalStaked, totalAirdropped };
};

const getDueSpdrs = async () => {
  const snap = await admin
    .firestore()
    .collection(COL.SPDR)
    .where('status', '==', SpdrStatus.UNPROCESSED)
    .where('endDate', '<=', dateToTimestamp(dayjs()))
    .get();
  return snap.docs.map((d) => <Spdr>d.data());
};

const createAirdrops = async (
  token: Token,
  spdr: Spdr,
  totalStaked: number,
  stakedPerMember: { [key: string]: number },
) => {
  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data();

  const promises = Object.entries(stakedPerMember).map(async ([member, total]) => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`);
    const count = Math.floor((total / totalStaked) * spdr.tokensToDistribute);
    if (!count) {
      return 0;
    }
    const airdropData = {
      parentId: token.uid,
      parentCol: COL.TOKEN,
      uid: member,
      tokenDrops: admin.firestore.FieldValue.arrayUnion(<TokenDrop>{
        vestingAt: spdr.tokenVestingDate,
        count,
        uid: getRandomEthAddress(),
        sourceAddress: space.vaultAddress,
        spdrId: spdr.uid,
      }),
    };
    await distributionDocRef.set(uOn(airdropData), { merge: true });
    return count;
  });
  return (await Promise.all(promises)).reduce((acc, act) => acc + act, 0);
};
