export const wrappedFetch = <T>(url: string, params: Record<string, unknown>) =>
  new Promise<T>((res, rej) => {
    return fetch(url + toQueryParams(params))
      .then((r) => {
        res(r.json());
      })
      .catch((error) => {
        rej(error);
      });
  });

const toQueryParams = (params: Record<string, unknown>) => {
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
