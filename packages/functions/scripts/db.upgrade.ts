import { COL } from '@soonaverse/interfaces';
import crypto from 'crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import glob from 'glob';
import serviceAccount from './serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccount as any),
});

const execute = async () => {
  const db = getFirestore(app);
  const files = glob.sync(`./dbUpgrades/**/*.ts`);
  for (const file of files) {
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
    await func.roll(app);
    await docRef.create({});
  }
};

const pathToImportFileName = (path: string) =>
  path.replace('packages/functions/scripts', '.').replace('.ts', '');

execute();
