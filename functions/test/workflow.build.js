const glob = require('glob');
const fs = require('fs');
const path = require('path')

const errorMsg = 'Could not generate test workflow file.';
const outputFile = '../.github/workflows/functions-unit-tests_emulator.yml'

function getJobForFile(filePath) {
  const fileName = filePath.replaceAll('.', '-').replaceAll('/', '-')
  fs.appendFileSync(outputFile, `  functions_unit_tests_emulator_${fileName}:\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 60\n`);
  fs.appendFileSync(outputFile, `    defaults:\n`);
  fs.appendFileSync(outputFile, `      run:\n`);
  fs.appendFileSync(outputFile, `        working-directory: functions\n`);
  fs.appendFileSync(outputFile, `    env:\n`);
  fs.appendFileSync(outputFile, `      FIREBASE_TOKEN: \${{ secrets.FIREBASE_DEV_TOKEN }}\n`);
  fs.appendFileSync(outputFile, `    steps:\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/checkout@v2\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/setup-node@v1\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          node-version: '16'\n`);
  fs.appendFileSync(outputFile, `      - run: npm install\n`);
  fs.appendFileSync(outputFile, `      - run: npm install -g firebase-tools\n`);
  fs.appendFileSync(outputFile, `      - run: npm run build\n`);
  fs.appendFileSync(outputFile, `      - run: ./node_modules/.bin/firebase use dev\n`);
  fs.appendFileSync(outputFile, `      - run: ./node_modules/.bin/firebase emulators:exec --only functions,firestore "npm run test -- --findRelatedTests ${filePath}" --project dev\n\n`);
}

try {
  fs.writeFileSync(outputFile, 'name: Functions Emulated Unit Tests\n');
  fs.appendFileSync(outputFile, 'on: push\n');
  fs.appendFileSync(outputFile, 'jobs:\n\n');
  glob.sync(`./test/**/*.spec.ts`).forEach(getJobForFile)
} catch (e) {
  console.error(errorMsg, e);
}