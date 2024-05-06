import { Knex } from 'knex';
import { isEmpty } from 'lodash';

export const createSingleFieldIndexes = async (knex: Knex) => {
  const columns = await knex
    .withSchema('information_schema')
    .table('columns')
    .whereIn('table_schema', ['public'])
    .whereNotIn('table_name', [
      'knex_migrations',
      'knex_migrations_lock',
      'pg_stat_statements',
      'changes',
      'ticker',
    ])
    .whereRaw(`"table_name" not like 'milestone%'`)
    .orderBy('table_schema')
    .orderBy('table_name', 'desc')
    .orderBy('ordinal_position')
    .select(
      'table_schema as schema',
      'table_name as table',
      'column_name as column',
      knex.raw("(is_nullable = 'YES') as nullable"),
      'column_default as default',
      'data_type as type',
      'udt_name as udt',
    );

  const indexes = columns
    .map(({ table, udt, column }) => {
      if (column === 'uid' || !shouldCreateIndex(udt)) {
        return;
      }
      return `CREATE INDEX IF NOT EXISTS ${table}_${column} on ${table} ("${column}");`;
    })
    .filter((index) => !isEmpty(index))
    .join(' ');
  await knex.raw(indexes);
};

const shouldCreateIndex = (fieldType: string) => {
  switch (fieldType) {
    case 'bool':
    case 'numeric':
    case 'int8':
    case 'varchar':
    case 'time':
    case 'smallint':
    case 'integer':
    case 'int':
    case 'int2':
    case 'int4':
    case 'real':
    case 'float':
    case 'float4':
    case 'float8':
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return true;
    default:
      return false;
  }
};
