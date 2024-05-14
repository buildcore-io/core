import initKnex from 'knex';
import { createChangeTriggers } from './create.triggers';
import { createCompositeIndexes } from './indexes/composit.indexes';
import { createSingleFieldIndexes } from './indexes/single.field.indexes';

const knex = initKnex({
  client: 'pg',
  connection: {
    user: 'postgres',
    password: process.env.DB_USER_PWD,
    database: 'buildcore',
    host: '127.0.0.1',
  },
  migrations: {
    directory: '../database/migrations',
    extension: 'ts',
  },
});

const migrate = async () => {
  await knex.migrate.latest();

  await createChangeTriggers(knex);
  await createSingleFieldIndexes(knex);
  await createCompositeIndexes(knex);

  await knex.destroy();
};

migrate();
