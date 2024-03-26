import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('changes', (t) => {
    t.increments('uid').primary();
    t.jsonb('change').defaultTo({});
  });
}

export async function down(): Promise<void> {}
