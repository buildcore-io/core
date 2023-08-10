import { processObject, processObjectArray } from './utils';

let isAppOnline = true;

export const isOnlineCheckInterval = setInterval(async () => {
  if (isAppOnline) {
    return;
  }
  try {
    const response = await fetch('https://soonaverse.com', { method: 'HEAD' });
    isAppOnline = response.ok;
  } catch {
    isAppOnline = false;
  }
}, 1000);

export const isOnline = () => {
  if (isAppOnline) {
    return;
  }
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (isAppOnline) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });
};

export const wrappedFetch = async <T>(url: string, params: Record<string, unknown>) => {
  try {
    await isOnline();
    const r = await fetch(url + toQueryParams(params));
    const json = await r.json();
    if (Array.isArray(json)) {
      return processObjectArray(json) as T;
    }
    return processObject(json) as T;
  } catch (error) {
    isAppOnline = false;
    throw error;
  }
};

export const wrappedFetchRaw = async (url: string, config: RequestInit) => {
  try {
    await isOnline();
    return fetch(url, config);
  } catch (error) {
    isAppOnline = false;
    throw error;
  }
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
