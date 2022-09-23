const glob = require('glob');
const fs = require('fs');

const errorMsg = 'Could not generate test workflow file.';
const outputFile =
  '../.github/workflows/tangle-online-functions-unit-tests_emulator.yml';

function getJobForFile(filePath) {
  const fileName = filePath
    .replaceAll('./test-tangle/', '')
    .replaceAll('/', '_')
    .replaceAll('.', '-')
  fs.appendFileSync(outputFile, `  ${fileName}:\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 60\n`);
  fs.appendFileSync(outputFile, `    defaults:\n`);
  fs.appendFileSync(outputFile, `      run:\n`);
  fs.appendFileSync(outputFile, `        working-directory: functions\n`);
  fs.appendFileSync(outputFile, `    steps:\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/checkout@v2\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/setup-node@v1\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          node-version: '16'\n`);
  fs.appendFileSync(outputFile, `      - run: npm install\n`);
  fs.appendFileSync(outputFile, `      - run: npm run build\n`);
  fs.appendFileSync(
    outputFile,
    `      - run: npm run test-tangle-online -- --findRelatedTests ${filePath}\n\n`,
  );
}

try {
  fs.writeFileSync(
    outputFile,
    'name: Tangle - Online - Functions Emulated Unit Tests\n',
  );
  fs.appendFileSync(outputFile, 'on:\n')
  fs.appendFileSync(outputFile, '  workflow_run:\n')
  fs.appendFileSync(outputFile, '    workflows: [\'Firebase Deploy DEV\']\n')
  fs.appendFileSync(outputFile, '    types: [completed]\n')
  fs.appendFileSync(outputFile, '    branches:\n')
  fs.appendFileSync(outputFile, '      - \'online_testing\'\n')
  fs.appendFileSync(outputFile, 'jobs:\n');
  glob.sync(`./test-tangle/**/*.spec.ts`).forEach(getJobForFile);
} catch (e) {
  console.error(errorMsg, e);
}
