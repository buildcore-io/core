const glob = require('glob');
const fs = require('fs');

const errorMsg = 'Could not generate test workflow file.';
const outputFile = '../.github/workflows/tangle-online-functions-unit-tests_emulator.yml';

function getJobForFile(filePath) {
  const fileName = filePath
    .replaceAll('./test-tangle/', '')
    .replaceAll('/', '_')
    .replaceAll('.', '-');
  fs.appendFileSync(outputFile, `  ${fileName}:\n`);
  fs.appendFileSync(outputFile, `    needs: npm-intstall\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 30\n`);
  fs.appendFileSync(outputFile, `    defaults:\n`);
  fs.appendFileSync(outputFile, `      run:\n`);
  fs.appendFileSync(outputFile, `        working-directory: functions\n`);
  fs.appendFileSync(outputFile, `    env:\n`);
  fs.appendFileSync(outputFile, `      FIREBASE_TOKEN: \${{ secrets.FIREBASE_DEV_TOKEN }}\n`);
  fs.appendFileSync(outputFile, `    steps:\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/checkout@v3\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/setup-node@v3\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          node-version: '16'\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/cache@v3\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          path: '**/node_modules'\n`);
  fs.appendFileSync(
    outputFile,
    `          key: \${{ runner.os }}-modules-\${{ hashFiles('**/package.json') }}\n`,
  );
  fs.appendFileSync(outputFile, `      - run: npm install -g firebase-tools@11.14.1\n`);
  fs.appendFileSync(outputFile, `      - run: npm run build\n`);
  fs.appendFileSync(outputFile, `      - run: firebase use dev\n`);
  fs.appendFileSync(
    outputFile,
    `      - run: firebase emulators:exec "npm run test-tangle-online -- --findRelatedTests ${filePath}" --project dev\n\n`,
  );
}

try {
  fs.writeFileSync(outputFile, 'name: Tangle - Functions Emulated Unit Tests\n\n');
  fs.appendFileSync(outputFile, 'on:\n');
  fs.appendFileSync(outputFile, '  workflow_run:\n');
  fs.appendFileSync(outputFile, '    workflows: ["Firebase Deploy DEV"]\n');
  fs.appendFileSync(outputFile, '    types: [completed]\n');
  fs.appendFileSync(outputFile, '    branches:\n');
  fs.appendFileSync(outputFile, '      - "develop"\n');

  fs.appendFileSync(outputFile, 'jobs:\n');
  fs.appendFileSync(outputFile, '  npm-intstall:\n');
  fs.appendFileSync(outputFile, '    runs-on: ubuntu-latest\n');
  fs.appendFileSync(outputFile, '    timeout-minutes: 10\n');
  fs.appendFileSync(outputFile, '    defaults:\n');
  fs.appendFileSync(outputFile, '      run:\n');
  fs.appendFileSync(outputFile, '        working-directory: functions\n');
  fs.appendFileSync(outputFile, '    steps:\n');
  fs.appendFileSync(outputFile, '      - uses: actions/checkout@v3\n');
  fs.appendFileSync(outputFile, '      - uses: actions/setup-node@v3\n');
  fs.appendFileSync(outputFile, '        with:\n');
  fs.appendFileSync(outputFile, '          node-version: 16\n');
  fs.appendFileSync(outputFile, '      - uses: actions/cache@v3\n');
  fs.appendFileSync(outputFile, '        id: cache\n');
  fs.appendFileSync(outputFile, '        with:\n');
  fs.appendFileSync(outputFile, "          path: '**/node_modules'\n");
  fs.appendFileSync(
    outputFile,
    "          key: ${{ runner.os }}-modules-${{ hashFiles('**/package.json') }}\n",
  );
  fs.appendFileSync(outputFile, '      - name: Install Dependencies\n');
  fs.appendFileSync(outputFile, "        if: steps.cache.outputs.cache-hit != 'true'\n");
  fs.appendFileSync(outputFile, '        run: npm install\n\n');

  glob.sync(`./test-tangle/**/*.spec.ts`).forEach(getJobForFile);
} catch (e) {
  console.error(errorMsg, e);
}