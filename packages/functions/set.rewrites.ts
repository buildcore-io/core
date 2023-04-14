import { WEN_FUNC } from '@soonaverse/interfaces';
import fs from 'fs';
import firebase from '../../firebase.json';
const setRewrites = () => {
  const config = firebase;
  const rewrites = Object.entries(WEN_FUNC)
    .filter(([_, f]) => f !== WEN_FUNC.api)
    .map(
      ([key, value]) =>
        ({ source: `/api/post${key[0].toUpperCase() + key.slice(1)}`, function: value } as any),
    )
    .concat([
      { source: '/api/**', function: 'api' },
      {
        source: '**',
        destination: '/index.html',
      },
    ]);
  for (let i = 0; i < firebase.hosting.length; ++i) {
    config.hosting[i].rewrites = rewrites;
  }
  fs.writeFileSync('../../firebase.json', JSON.stringify(config));
};

setRewrites();
