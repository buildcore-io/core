const fs = require('fs');
const json = require('./packages/functions/package.json');

fs.writeFileSync(
  'packages/functions/package.json',
  JSON.stringify(
    {
      ...json,
      dependencies: {
        ...json.dependencies,
        '@build-5/interfaces': 'file:./interfaces',
        '@build-5/database': 'file:./database',
      },
    },
    null,
    2,
  ) + '\n',
);
