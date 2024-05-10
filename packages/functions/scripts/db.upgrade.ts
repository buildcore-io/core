import { database } from '@buildcore/database';
import dotenv from 'dotenv';
const glob = require('glob');

dotenv.config({ path: '../.env' });

const execute = async () => {
  const files = glob.sync(`./dbUpgrades/**/*.ts`);
  for (const file of files.sort()) {
    console.log(`Running ${file}`);
    const func = await import(pathToImportFileName(file));
    await func.roll();
  }

  await database().destroy();
};

const pathToImportFileName = (path: string) => './' + path.replace('.ts', '');

execute();
