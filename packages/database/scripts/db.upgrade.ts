import { COL } from '@build-5/interfaces';
import crypto from 'crypto';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import {globSync} from 'glob';
import { FirebaseApp } from '../src/app/app';
import serviceAccount from './serviceAccountKey.json';

dotenv.config({ path: '../.env' });

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
});
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: serviceAccount.project_id });

const execute = async () => {
  const db = getFirestore(app);
  const files = globSync(`./dbUpgrades/**/*.ts`);
  for (const file of files.sort()) {
    const content = fs.readFileSync(file);
    const hash = crypto.createHash('sha1').update(content).digest('hex');

    const docRef = db.doc(`${COL.DB_ROLL_FILES}/${hash}`);
    const doc = await docRef.get();
    if (doc.exists) {
      console.warn(`${file} script was already ran`);
      continue;
    }

    console.log(`Running ${file}`);
    const func = await import(pathToImportFileName(file));
    await func.roll(new FirebaseApp(app));
    await docRef.create({});
  }
};

const pathToImportFileName = (path: string) => './' + path.replace('.ts', '');

execute();
