// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: __dirname + '/.env' });
import { PgProjectAdmins, PgProjectUpdate, PgTokenUpdate, build5Db } from '@build-5/database';
import {
  Access,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  ProjectBilling,
  SOON_PROJECT_ID,
  SUB_COL,
  TokenStatus,
} from '@build-5/interfaces';
import initKnex from 'knex';
import { createChangeTriggers } from './migration/create.triggers';
import { createCompositeIndexes } from './migration/indexes/composit.indexes';
import { createSingleFieldIndexes } from './migration/indexes/single.field.indexes';

const MEDIA =
  'https://images-wen.soonaverse.com/0x0275dfc7c2624c0111d441a0819dccfd5e947c89%2F6stvhnutvg%2Ftoken_introductionary';
const SOON_PROJ_GUARDIAN = '0x3d5d0b3f40c9438871b1c43d6b70117eeff77ad8';
const soonTokenId = '0xa381bfccaf121e38e31362d85b5ad30cd7fc0d06';
const rmsTokenId = '0x52f27a34170900537acb61e5ff0fe94a2841ff52';

const knex = initKnex({
  client: 'pg',
  connection: {
    user: process.env.DB_USER,
    password: process.env.DB_USER_PWD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
  },
  migrations: {
    directory: '../database/migrations',
    extension: 'ts',
  },
});

const setup = async () => {
  await migrateSchema();

  await build5Db()
    .doc(COL.TOKEN, soonTokenId)
    .upsert({
      project: SOON_PROJECT_ID,
      uid: soonTokenId,
      name: 'Soon token',
      symbol: 'SOON',
    } as PgTokenUpdate);

  await build5Db().doc(COL.TOKEN, rmsTokenId).upsert({
    project: SOON_PROJECT_ID,
    symbol: 'RMS',
    approved: true,
    name: 'RMS token',
    status: TokenStatus.BASE,
    access: Access.OPEN,
    icon: MEDIA,
    mintingData_network: Network.RMS,
  });

  const soonProject: PgProjectUpdate = {
    name: 'Soonaverse',
    createdBy: SOON_PROJ_GUARDIAN,
    deactivated: false,
    config_billing: ProjectBilling.TOKEN_BASED,
    config_tiers: [0, 0, 0, 0, 0].map((v) => v * MIN_IOTA_AMOUNT),
    config_tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
    config_nativeTokenSymbol: 'SOON',
    config_nativeTokenUid: soonTokenId,
    otr: JSON.stringify({}),
  };

  const soonProjDocRef = build5Db().doc(COL.PROJECT, SOON_PROJECT_ID);
  await soonProjDocRef.upsert(soonProject);
  const adminDocRef = build5Db().doc(
    COL.PROJECT,
    SOON_PROJECT_ID,
    SUB_COL.ADMINS,
    SOON_PROJ_GUARDIAN,
  );
  const admin: PgProjectAdmins = {
    uid: SOON_PROJ_GUARDIAN,
    project: SOON_PROJECT_ID,
    parentId: SOON_PROJECT_ID,
  };
  await adminDocRef.upsert(admin);

  await build5Db().destroy();
  await knex.destroy();
  console.log('Setup env');
};

const migrateSchema = async () => {
  await knex.migrate.latest();

  await createChangeTriggers(knex);
  await createSingleFieldIndexes(knex);
  await createCompositeIndexes(knex);

  if (!(await knex.schema.hasTable('blocks'))) {
    await knex.schema.createTable('blocks', (t) => {
      t.timestamp('createdOn').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      t.string('blockId').primary();
    });
  }

  await knex.raw(`     
    CREATE OR REPLACE FUNCTION block_func() RETURNS TRIGGER AS $$ 
    BEGIN
      PERFORM pg_notify('blocks', NEW."blockId");        
      RETURN NEW;      
    END;      
    $$ LANGUAGE plpgsql;      
    CREATE OR REPLACE TRIGGER block AFTER INSERT ON blocks
    FOR EACH ROW EXECUTE FUNCTION block_func();   
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS transaction_3997722307389455 ON transaction ("payload_sourceTransaction", uid);
  `);
};

export default setup;
