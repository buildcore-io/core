import { merge } from 'lodash';

export function keywords(o: any): any {
  if (!o.name || o.name.length === 0 || !o.uid || o.uid.length === 0) {
    return o;
  }

  const c = o.name.toLowerCase();
  const array: string[] = [];
  const parts = c.split(' ', 5); // Maximum five.
  for (let i = 1; i < parts.length + 1; i++) {
    for (let ii = 1; ii < c.length + 1; ii++) {
      array.push(c.substring(parts.reduce((v: any, a: number, index: number) => {
        if (index < i) {
          return a;
        }

        return (v || '').length + a;
      }, 0), ii));
    }
  }

  return merge(o, {
    keywords: array
  });
}
;
