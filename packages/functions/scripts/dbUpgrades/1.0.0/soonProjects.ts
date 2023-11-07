import { FirebaseApp, Firestore } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  ProjectBilling,
  SOON_PROJECT_ID,
  SUB_COL,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import serviceAccount from '../../serviceAccountKey.json';

const ADMIN_ID = '0x551fd2c7c7bf356bac194587dab2fcd46420054b';

export const creditHighestPayment = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  const isProdEnv = serviceAccount.project_id === 'soonaverse';

  const project = isProdEnv ? prodProject : testProject;
  const projectDocRef = db.doc(`${COL.PROJECT}/${project.uid}`);

  if ((await projectDocRef.get()) !== undefined) {
    console.log('Project already created');
    return;
  }

  const batch = db.batch();

  batch.create(projectDocRef, project);

  const adminDocRef = projectDocRef.collection(SUB_COL.ADMINS).doc(ADMIN_ID);
  const admin = {
    project: SOON_PROJECT_ID,
    projects: [SOON_PROJECT_ID],
    uid: ADMIN_ID,
    createdOn: dayjs().toDate(),
    parentCol: COL.PROJECT,
    parentId: project.uid,
  };
  batch.create(adminDocRef, admin);

  const rawJwt = { uid: ADMIN_ID, project: project.uid, iat: dayjs().unix() };
  const signed = jwt.sign(rawJwt, process.env.JWT_SECRET as string);
  const apiKey = {
    uid: '0xf43ea8069e6ed7006983c5037f35995af199bebf',
    token: signed,
    parentCol: COL.PROJECT,
    parentId: project.uid,
    createdOn: dayjs().toDate(),
  };
  const apiKeyDocRef = projectDocRef.collection(SUB_COL._API_KEY).doc();
  batch.create(apiKeyDocRef, apiKey);

  await batch.commit();
};

const testProject = {
  uid: SOON_PROJECT_ID,
  name: 'Soonaverse',
  createdBy: ADMIN_ID,
  deactivated: false,
  config: {
    billing: ProjectBilling.TOKEN_BASE,
    tiers: [0, 0, 0, 0, 0].map((v) => v * MIN_IOTA_AMOUNT),
    tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
    nativeTokenSymbol: 'SOON',
    nativeTokenUid: '0x36ebf336f63f64718d088ec31c1db3151e0d8317',
  },
};

const prodProject = {
  uid: SOON_PROJECT_ID,
  name: 'Soonaverse',
  createdBy: ADMIN_ID,
  deactivated: false,
  config: {
    billing: ProjectBilling.TOKEN_BASE,
    tiers: [0, 10, 4000, 6000, 15000].map((v) => v * MIN_IOTA_AMOUNT),
    tokenTradingFeeDiscountPercentage: [0, 25, 50, 75, 100],
    nativeTokenSymbol: 'SOON',
    nativeTokenUid: '0x9600b5afbb84f15e0d4c0f90ea60b2b8d7bd0f1e',
  },
};

export const roll = creditHighestPayment;
