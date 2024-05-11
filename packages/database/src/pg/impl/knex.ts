import Knex from 'knex';

export const knex: Knex.Knex = Knex({
  client: 'pg',
  connection: {
    user: process.env.DB_USER,
    password: process.env.DB_USER_PWD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN || 0),
    max: Number(process.env.DB_POOL_MAX || 20),
  },
});

export const knextran: Knex.Knex = Knex({
  client: 'pg',
  connection: {
    user: process.env.DB_USER,
    password: process.env.DB_USER_PWD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN || 0),
    max: Number(process.env.DB_POOL_MAX || 20),
  },
});
