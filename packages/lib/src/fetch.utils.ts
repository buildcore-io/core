import { processObject, processObjectArray } from './utils';

export const wrappedFetch = async <T>(url: string, params: Record<string, unknown>) => {
  const r = await fetch(url + toQueryParams(params));
  const json = await r.json();
  if (Array.isArray(json)) {
    return processObjectArray(json) as T;
  }
  return processObject(json) as T;
};

export const toQueryParams = (params: Record<string, unknown>) => {
  let query = '';
  for (const entry of Object.entries(params)) {
    if (entry[1] === undefined) {
      continue;
    }
    if (Array.isArray(entry[1])) {
      for (const value of entry[1]) {
        query += `&${entry[0]}[]=${value}`;
      }
      continue;
    }
    query += `&${entry[0]}=${entry[1]}`;
  }
  return query.replace('&', '?');
};
