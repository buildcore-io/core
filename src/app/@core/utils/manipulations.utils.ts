export function undefinedToEmpty(o: any): any {
  Object.keys(o).forEach((k: any) => {
    if (o[k] === undefined) {
      o[k] = '';
    }

    return o;
  });

  return o;
}
