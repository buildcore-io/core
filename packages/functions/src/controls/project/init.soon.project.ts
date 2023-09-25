import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  ProjectBilling,
  ProjectGuardian,
  SOON_PROJECT_ID,
  SUB_COL,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions/v2';
import jwt from 'jsonwebtoken';
import { getJwtSecretKey, isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

const GUARDIAN_ID = '0x551fd2c7c7bf356bac194587dab2fcd46420054b';

export const initSoonProject = functions.https.onRequest(async () => {
  const project = isProdEnv() ? prodProject : testProject;
  const projectDocRef = build5Db().doc(`${COL.PROJECT}/${project.uid}`);

  if ((await projectDocRef.get()) !== undefined) {
    return;
  }

  const batch = build5Db().batch();

  batch.create(projectDocRef, project);

  const guardianDocRef = projectDocRef.collection(SUB_COL.GUARDIANS).doc(GUARDIAN_ID);
  const guardian: ProjectGuardian = {
    project: SOON_PROJECT_ID,
    projects: { [SOON_PROJECT_ID]: true },
    uid: GUARDIAN_ID,
    createdOn: dateToTimestamp(dayjs()),
    parentCol: COL.PROJECT,
    parentId: project.uid,
  };
  batch.create(guardianDocRef, guardian);

  const rawJwt = { uid: GUARDIAN_ID, project: project.uid, iat: dayjs().unix() };
  const signed = jwt.sign(rawJwt, getJwtSecretKey());
  const apiKey = {
    uid: getRandomEthAddress(),
    token: signed,
    parentCol: COL.PROJECT,
    parentId: project.uid,
    createdOn: dateToTimestamp(dayjs()),
  };
  const apiKeyDocRef = projectDocRef.collection(SUB_COL._API_KEY).doc();
  batch.create(apiKeyDocRef, apiKey);

  await batch.commit();
});

const testProject = {
  uid: SOON_PROJECT_ID,
  name: 'Soonaverse',
  createdBy: GUARDIAN_ID,
  deactivated: false,
  config: {
    billing: ProjectBilling.TOKEN_BASE,
    tiers: [0, 0, 0, 0, 0].map((v) => v * MIN_IOTA_AMOUNT),
    tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
    baseTokenSymbol: 'SOON',
    baseTokenUid: '0x36ebf336f63f64718d088ec31c1db3151e0d8317',
  },
};

const prodProject = {
  uid: SOON_PROJECT_ID,
  name: 'Soonaverse',
  createdBy: GUARDIAN_ID,
  deactivated: false,
  config: {
    billing: ProjectBilling.TOKEN_BASE,
    tiers: [0, 10, 4000, 6000, 15000].map((v) => v * MIN_IOTA_AMOUNT),
    tokenTradingFeeDiscountPercentage: [0, 25, 50, 75, 100],
    baseTokenSymbol: 'SOON',
    baseTokenUid: '0x9600b5afbb84f15e0d4c0f90ea60b2b8d7bd0f1e',
  },
};
