import { processObject, processObjectArray } from './utils';

let isAppOnline = true;

/**
 * Helper function to check online status
 */
export const isOnlineCheckInterval = setInterval(async () => {
  if (isAppOnline) {
    return;
  }
  try {
    const response = await fetch('https://build5.com', { method: 'HEAD' });
    isAppOnline = response.ok;
  } catch {
    isAppOnline = false;
  }
}, 1000);

/**
 * Promise based function to provide online status.
 * 
 * @returns 
 */
export const isOnline = (): any => {
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

/**
 * Wrapped fetch function to inject bearer and process responses
 * 
 * @param token 
 * @param url 
 * @param params 
 * @returns 
 */
export const wrappedFetch = async <T>(
  token: string,
  url: string,
  params: Record<string, unknown>,
) => {
  try {
    await isOnline();
    const r = await fetch(url + toQueryParams(params), {
      headers: { Authorization: 'Bearer ' + token },
    });
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

/**
 * Convert object into query params
 * 
 * @param params 
 * @returns 
 */
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
