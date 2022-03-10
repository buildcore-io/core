export function undefinedToEmpty(o: any): any {
  Object.keys(o).forEach((k: any) => {
    if (o[k] === undefined || o[k] === '') {
      o[k] = null;
    }

    // Objects.
    if (
      typeof o[k] === 'object' &&
      !Array.isArray(o[k]) &&
      o[k] !== null
    ) {
      o[k] = undefinedToEmpty(o[k]);
    }

    // Arrays. We assume there is an array directly under it.
    if (Array.isArray(o[k]) && o[k].length > 0) {
      o[k].forEach((v: any, i: number) => {
        o[k][i] = undefinedToEmpty(o[k][i]);
      });
    }

    return o;
  });

  return o;
}

export function enumToArray(e: any): any[] {
  const keys = Object.keys(e);
  return keys.filter((k: any) => typeof k !== 'number' && isNaN(Number(k))).map((k: any) => ({ key: k, value: e[k] }));
}