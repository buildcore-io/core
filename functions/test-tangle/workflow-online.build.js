const glob = require('glob');
const fs = require('fs');
const { chunk } = require('lodash');

const errorMsg = 'Could not generate test workflow file.';
const outputFile = '../.github/workflows/tangle-online-functions-unit-tests_emulator.yml';

function job(chunk, files) {
  fs.appendFileSync(outputFile, `  job_${chunk}:\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 60\n`);
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
  fs.appendFileSync(outputFile, `      - run: npm install\n`);
  fs.appendFileSync(outputFile, `      - run: npm install -g firebase-tools@11.14.1\n`);
  fs.appendFileSync(outputFile, `      - run: npm install -g npm-run-all\n`);
  fs.appendFileSync(outputFile, `      - run: npm run build\n`);
  fs.appendFileSync(outputFile, `      - run: firebase use dev\n`);
  fs.appendFileSync(outputFile, `      - run: firebase emulators:exec \n`);
  fs.appendFileSync(outputFile, `             "run-p \n`);
  for (const file of files) {
    fs.appendFileSync(
      outputFile,
      `             \\"test-tangle-online -- --findRelatedTests ${file}\\" \n`,
    );
  }
  fs.appendFileSync(outputFile, `             "\n`);
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

  const files = glob.sync(`./test-tangle/**/*.spec.ts`);
  const alone = files.filter((f) => f.includes('alone.spec.ts'));
  const rest = files.filter((f) => !f.includes('alone.spec.ts'));
  const restChunks = chunk(rest, 5);
  restChunks.forEach((chunk, i) => job(i, chunk));
  chunk(alone, 1).forEach((chunk, i) => job(i + restChunks.length, chunk));
} catch (e) {
  console.error(errorMsg, e);
}
