function keywords(o: any): any {
  if (!o.name || o.name.length === 0 || !o.uid || o.uid.length === 0) {
    return o;
  }

  const name = o.name.toLowerCase();
  const id = o.uid.toLowerCase();
  const array: string[] = [];
  [name, id].forEach((c) => {
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
}


console.log(keywords({
  uid: '0x21313131sadasdasdasdasdasdad',
  name: 'sdaFAsd adas asdasdasdasd asd asd asd as das dsa'
}));
