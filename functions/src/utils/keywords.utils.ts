export function keywords(o: any): any {
  const recToIndex: string[] = [];
  if (o.name && o.name.length > 0) {
    recToIndex.push(o.name.toLowerCase());
  }

  if (o.uid && o.uid.length > 0) {
    recToIndex.push(o.uid.toLowerCase());
  }
  if (recToIndex.length === 0) {
    return o;
  }

  const array: string[] = [];
  recToIndex.forEach((c) => {
    for (let ii = 1; ii < c.length + 1; ii++) {
      array.push(c.substring(0, ii));
    }
  });

  return {
    ...o,
    ...{
      keywords: array
    }
  };
};
