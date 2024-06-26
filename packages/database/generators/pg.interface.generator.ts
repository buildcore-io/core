import fs from 'fs';
import Knex from 'knex';
import * as knexfile from '../knexfile';

const baseFolder = './src/pg/models/';

const createCommons = async (isUpdate: boolean) => {
  const filePath = baseFolder + `common${isUpdate ? '_update' : ''}.ts`;
  let content = setWarningText(filePath);

  if (isUpdate) {
    content += 'export interface Update {}\n';
  }

  content +=
    `export interface BaseRecord${isUpdate ? 'Update extends Update' : ''} {\n` +
    (isUpdate ? '' : '  uid: string;') +
    '  project?: string;' +
    '  createdOn?: Date;' +
    '  updatedOn?: Date ;' +
    '  createdBy?: string;\n}\n';

  content +=
    `export interface BaseSubRecord${isUpdate ? 'Update extends Update' : ''} extends BaseRecord${isUpdate ? 'Update' : ''}  {\n` +
    `parentId${isUpdate ? '?' : ''}: string;}`;

  fs.writeFileSync(filePath, content);
};

const excludeProps = ['uid', 'project', 'createdOn', 'updatedOn', 'createdBy', 'parentId'];

const createInterfaces = async (tables: { [key: string]: any }) => {
  for (const [tableName, props] of Object.entries(tables)) {
    const filePath = baseFolder + `${getFileName(tableName)}.ts`;
    let content = setWarningText(filePath);

    const interfaceName = getInterfaceName(tableName);

    content += `\nexport interface ${interfaceName} `;
    const columns = props.map((p: any) => p.column);

    if (columns.includes('parentId')) {
      content += 'extends commons.BaseSubRecord {\n';
    } else {
      content += 'extends commons.BaseRecord {\n';
    }

    for (const prop of props) {
      if (excludeProps.includes(prop.column)) {
        continue;
      }
      content +=
        `  ${prop.column}` +
        `${prop.nullable ? '?' : ''}` +
        `: ${getType(prop.udt, prop.default)}` +
        `;\n`;
    }
    content += `}\n`;
    fs.appendFileSync(filePath, content);

    fs.appendFileSync(baseFolder + 'index.ts', `export * from "./${getFileName(tableName)}";\n`);
    fs.appendFileSync(
      baseFolder + 'index.ts',
      `export * from "./${getFileName(tableName)}_update";\n`,
    );
  }
};

const createUpdateInterfaces = async (tables: { [key: string]: any }) => {
  for (const [tableName, props] of Object.entries(tables)) {
    const filePath = baseFolder + `${getFileName(tableName)}_update.ts`;
    let content = setWarningText(filePath, true);

    const interfaceName = getInterfaceName(tableName);

    content += `\nexport interface ${interfaceName}Update `;
    const columns = props.map((p: any) => p.column);

    if (columns.includes('parentId')) {
      content += 'extends commons.BaseSubRecordUpdate {\n';
    } else {
      content += 'extends commons.BaseRecordUpdate {\n';
    }

    for (const prop of props) {
      if (excludeProps.includes(prop.column)) {
        continue;
      }
      const type = getType(prop.udt, prop.default, true);
      content += `  ${prop.column}`;
      content += '?';
      content += `: ${type}`;
      content += `${prop.nullable ? '| null ' : ''}`;
      content += type === 'number' ? ' | Increment' : '';
      content += type === 'string[]' ? ' | ArrayUnion<string> | ArrayRemove<string>' : '';
      content += `;\n`;
    }
    content += `}\n`;
    fs.appendFileSync(filePath, content);

    fs.appendFileSync(baseFolder + 'index.ts', `export * from "./${getFileName(tableName)}";\n`);
  }
};

const getFileName = (tableName: string) => {
  const index = tableName.indexOf('_');
  if (index === 0) {
    return tableName.substring(1, tableName.length);
  }
  if (index > -1) {
    return tableName.substring(0, index);
  }
  return tableName;
};

const setWarningText = (filePath: string, isUpdate = false) => {
  const exists = fs.existsSync(filePath);
  if (exists) {
    return '';
  }
  return (
    '/**\n' +
    ' * This file was automatically generated by knex\n' +
    ' * Do not modify this file manually\n' +
    ' */\n' +
    'import { Increment, ArrayUnion, ArrayRemove } from "../interfaces/common";\n' +
    (isUpdate
      ? 'import * as commons from "./common_update";\n'
      : 'import * as commons from "./common";\n')
  );
};

const getInterfaceName = (key: string, prefix = 'Pg') =>
  prefix +
  (key.charAt(0).toUpperCase() + key.slice(1))
    .replace(/_([a-z])/g, (_match, p1) => p1.toUpperCase())
    .replace('_', '');

const getType = (udt: string, defaultValue: string, isUpdate = false) => {
  switch (udt) {
    case 'bool':
      return 'boolean';
    case '_varchar':
      return 'string[]';
    case 'text':
    case 'citext':
    case 'money':
    case 'numeric':
    case 'int8':
    case 'char':
    case 'character':
    case 'bpchar':
    case 'varchar':
    case 'time':
    case 'tsquery':
    case 'tsvector':
    case 'uuid':
    case 'xml':
    case 'cidr':
    case 'inet':
    case 'macaddr':
      return 'string';
    case 'smallint':
    case 'integer':
    case 'int':
    case 'int2':
    case 'int4':
    case 'real':
    case 'float':
    case 'float4':
    case 'float8':
      return 'number';
    case '_int4':
    case '_float8':
      return 'number[]';
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return 'Date';
    case 'json':
    case 'jsonb':
      const isArray = defaultValue?.startsWith("'[");
      if (isUpdate) {
        return 'string' + (isArray ? '' : ' | any');
      }
      return 'Record<string, unknown>' + (isArray ? '[]' : '');
    case 'bytea':
      return 'Buffer';
    case 'interval':
      return 'PostgresInterval';
    case '_text':
      return 'string[]';
    default:
      return 'unknown';
  }
};

export const generatePgInterfaces = async () => {
  const knex = Knex(knexfile.default);
  createCommons(false);
  createCommons(true);

  const columns = await knex
    .withSchema('information_schema')
    .table('columns')
    .whereIn('table_schema', ['public'])
    .whereNotIn('table_name', ['knex_migrations', 'knex_migrations_lock', 'pg_stat_statements'])
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
  const tables: { [key: string]: any } = columns.reduce(
    (acc, act) => ({
      ...acc,
      [act.table]: [...(acc[act.table] || []), act],
    }),
    {} as { [key: string]: any },
  );

  await createInterfaces(tables);
  await createUpdateInterfaces(tables);
  await knex.destroy();
  process.exit();
};
