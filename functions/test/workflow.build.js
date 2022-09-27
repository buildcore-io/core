const glob = require('glob');
const fs = require('fs');
const path = require('path');

const errorMsg = 'Could not generate test workflow file.';
const outputFile = '../.github/workflows/functions-unit-tests_emulator.yml';

function getJobForFile(filePath) {
  const fileName = filePath
    .replaceAll('./test/controls/', '')
    .replaceAll('.', '-');
  fs.appendFileSync(outputFile, `  ${fileName}:\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 60\n`);
  fs.appendFileSync(outputFile, `    defaults:\n`);
  fs.appendFileSync(outputFile, `      run:\n`);
  fs.appendFileSync(outputFile, `        working-directory: functions\n`);
  fs.appendFileSync(outputFile, `    env:\n`);
  fs.appendFileSync(
    outputFile,
    `      FIREBASE_TOKEN: \${{ secrets.FIREBASE_DEV_TOKEN }}\n`,
  );
  fs.appendFileSync(outputFile, `    steps:\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/checkout@v2\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/setup-node@v1\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          node-version: '16'\n`);
  fs.appendFileSync(outputFile, `      - run: npm install\n`);
  fs.appendFileSync(outputFile, `      - run: npm install -g firebase-tools\n`);
  fs.appendFileSync(outputFile, `      - run: npm run build\n`);
  fs.appendFileSync(
    outputFile,
    `      - run: ./node_modules/.bin/firebase use dev\n`,
  );
  fs.appendFileSync(
    outputFile,
    `      - run: ./node_modules/.bin/firebase emulators:exec "npm run test -- --findRelatedTests ${filePath}" --project dev\n\n`,
  );
}

try {
  fs.writeFileSync(outputFile, 'name: Functions Emulated Unit Tests\n\n');
  
  fs.appendFileSync(outputFile, 'on:\n');
  fs.appendFileSync(outputFile, '  pull_request:\n');
  fs.appendFileSync(outputFile, '    paths:\n');
  fs.appendFileSync(outputFile, '      - functions/**\n\n');
  
  fs.appendFileSync(outputFile, 'jobs:\n\n');
  glob.sync(`./test/**/*.spec.ts`).forEach(getJobForFile);
} catch (e) {
  console.error(errorMsg, e);
}
