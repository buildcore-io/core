import Knex from 'knex';

const knex = Knex({
  client: 'pg',
  connection: {
    user: 'postgres', // e.g. 'my-user'
    password: 'postgres', // e.g. 'my-user-password'
    database: 'postgres', // e.g. 'my-database'
    host: 'localhost',
    port: 5432,
  },
  pool: { min: 1, max: 10 },
});

const main = async () => {
  const table = 'asd';
  if (!(await knex.schema.hasTable(table))) {
    await knex.schema.createTable(table, (t) => {
      t.text('uid').primary();
      t.integer('count').defaultTo(0);
    });
  }

  await knex(table).insert({ uid: 'asdasd', count: 2 });

  const res = await knex(table).select('*');
  console.log(res);

  await knex.schema.dropTable(table);

  await knex.destroy();
};

main();
