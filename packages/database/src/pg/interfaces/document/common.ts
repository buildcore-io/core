import { Knex } from 'knex';
import { isArray, isDate, isObject, isUndefined } from 'lodash';
import { ArrayRemove, ArrayUnion, Increment } from '../common';

export const toRaw = (knex: Knex, data: any) =>
  Object.entries(data).reduce((acc, [key, value]) => {
    if (value instanceof Increment) {
      return {
        ...acc,
        [key]: knex.raw(`COALESCE("${key}", 0) + ?`, [value.value]),
      };
    }
    if (value instanceof ArrayUnion) {
      return {
        ...acc,
        [key]: knex.raw(`array_cat("${key}", ?)`, [[value.value]]),
      };
    }
    if (value instanceof ArrayRemove) {
      return {
        ...acc,
        [key]: knex.raw(`array_remove("${key}", ?)`, [value.value]),
      };
    }

    if (isObject(value) && !isArray(value) && !isDate(value)) {
      const { acc: sql, bidings } = objectToJsonRaw(`"${key}"`, value);
      return { ...acc, [key]: knex.raw(sql, bidings) };
    }

    return { ...acc, [key]: isUndefined(value) ? null : value };
  }, {});

export const objectToJsonRaw = (column: string, data: any, keys: string[] = [], acc = column) => {
  let actAcc = acc;
  const bidings: any[] = [];
  Object.entries(data).forEach(([key, value]) => {
    const setPath = [...keys, key].join(', ');
    const fullPath = `${column}->${[...keys, key].map((k) => `'${k}'`).join('->')}`;

    if (!value) {
      actAcc = `jsonb_strip_nulls(jsonb_set(${actAcc}, '{${setPath}}', ?::jsonb))`;
      bidings.push(JSON.stringify(value));
      return;
    }
    if (value instanceof Increment) {
      actAcc =
        `jsonb_set(${actAcc}, '{${setPath}}', ` +
        `to_jsonb(COALESCE((${fullPath})::numeric, 0) + ?)::jsonb` +
        ')';
      bidings.push(JSON.stringify(value.value));
      return;
    }
    if (value instanceof ArrayUnion) {
      actAcc =
        `jsonb_set(${actAcc}, '{${setPath}}', ` +
        `COALESCE((${fullPath}), '[]'::jsonb) || ?::jsonb)`;
      bidings.push(JSON.stringify(value.value));
      return;
    }
    if (typeof value === 'object') {
      actAcc = `jsonb_set(${actAcc}, '{${setPath}}', COALESCE(${fullPath} ,'{}'::jsonb))`;
      const { acc, bidings: b } = objectToJsonRaw(column, value, [...keys, key], actAcc);
      actAcc = acc;
      bidings.push(...b);
      return;
    }
    if (typeof value === 'string') {
      actAcc = `jsonb_set(${actAcc}, '{${setPath}}', ?::jsonb)`;
      bidings.push(JSON.stringify(value));
      return;
    }
    actAcc = `jsonb_set(${actAcc}, '{${setPath}}', ?::jsonb)`;
    bidings.push(JSON.stringify(value));
  });
  return { acc: actAcc, bidings };
};
