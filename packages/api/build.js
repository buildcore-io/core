const package = require('./package.json');
const fs = require('fs');

delete package.dependencies['@build-5/interfaces'];
const prodPackageJson = {
  scripts: {
    preinstall: "./rustinstall.sh",
    start: 'node index',
  },
  dependencies: { ...package.dependencies, '@build-5/database': 'file:./database' },
};

fs.writeFileSync('./lib/package.json', JSON.stringify(prodPackageJson));
fs.copyFileSync('../../rustinstall.sh', './lib/rustinstall.sh')
