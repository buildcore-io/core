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
  const values = Object.values(e);
  return values.filter((v: any) => typeof v !== 'number').map((v: any) => ({ key: v, value: e[v] }));
}