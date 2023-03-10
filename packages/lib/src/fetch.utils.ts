import https from 'https';

export const fetch = <T>(url: string, params: Record<string, unknown>) =>
  new Promise<T>((res, rej) => {
    https
      .get(url + toQueryParams(params), (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            rej(data);
            return;
          }
          res(JSON.parse(data) as T);
        });
      })
      .on('error', (error) => {
        console.log(error);
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
