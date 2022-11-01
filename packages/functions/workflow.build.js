const glob = require('glob');
const fs = require('fs');
const { chunk } = require('lodash');

const tangleTestFile = '../../.github/workflows/tangle-functions-unit-tests.yml';
const tangleOnlineTestFile =
  '../../.github/workflows/tangle-online-functions-unit-tests_emulator.yml';
const emulatedTestFile = '../../.github/workflows/emulated-function-tests.yml';
const emulatedOnlineTestFile = '../../.github/workflows/online-emulated-function-tests.yml';

const tangleTestFileName = 'Tangle - Functions Emulated Unit Tests';
const tangleOnlineTestFileName = 'Tangle - Online - Functions Emulated Unit Tests';
const emulatedTestFileName = 'Functions Emulated Unit Tests';
const emulatedOnlineTestFileName = 'Online - Functions Emulated Unit Tests';

function setup(outputFile, title) {
  fs.writeFileSync(outputFile, `name: ${title}\n\n`);
  fs.appendFileSync(outputFile, 'on:\n');
  fs.appendFileSync(outputFile, '  pull_request:\n');
  fs.appendFileSync(outputFile, '    paths:\n');
  fs.appendFileSync(outputFile, '      - packages/functions/**\n\n');
}

function setupOnline(outputFile, title) {
  fs.writeFileSync(outputFile, `name: ${title}\n\n`);
  fs.appendFileSync(outputFile, 'on:\n');
  fs.appendFileSync(outputFile, '  workflow_run:\n');
  fs.appendFileSync(outputFile, '    workflows: ["Firebase Deploy DEV"]\n');
  fs.appendFileSync(outputFile, '    types: [completed]\n');
  fs.appendFileSync(outputFile, '    branches:\n');
  fs.appendFileSync(outputFile, '      - "develop"\n\n');
}

function init(outputFile) {
  fs.appendFileSync(outputFile, 'jobs:\n');
  fs.appendFileSync(outputFile, '  npm-intstall:\n');
  fs.appendFileSync(outputFile, '    runs-on: ubuntu-latest\n');
  fs.appendFileSync(outputFile, '    timeout-minutes: 10\n');
  fs.appendFileSync(outputFile, '    steps:\n');
  fs.appendFileSync(outputFile, '      - uses: actions/checkout@v3\n');
  fs.appendFileSync(outputFile, '      - uses: actions/setup-node@v3\n');
  fs.appendFileSync(outputFile, '        with:\n');
  fs.appendFileSync(outputFile, '          node-version: 16\n');
  fs.appendFileSync(outputFile, '      - uses: actions/cache@v3\n');
  fs.appendFileSync(outputFile, '        id: cache\n');
  fs.appendFileSync(outputFile, '        with:\n');
  fs.appendFileSync(outputFile, '          path: |\n');
  fs.appendFileSync(outputFile, '           node_modules\n');
  fs.appendFileSync(outputFile, '           packages/functions/node_modules\n');
  fs.appendFileSync(outputFile, '           packages/functions/lib\n');
  fs.appendFileSync(outputFile, '           packages/interfaces/node_modules\n');
  fs.appendFileSync(outputFile, '           packages/interfaces/lib\n');
  fs.appendFileSync(
    outputFile,
    "          key: ${{ runner.os }}-modules-${{ hashFiles('**/package.json') }}\n",
  );
  fs.appendFileSync(outputFile, '      - name: Install Dependencies\n');
  fs.appendFileSync(outputFile, '        run: npx lerna bootstrap --scope=@soon/functions\n\n');
}

function job(outputFile, chunk, files, commandName) {
  fs.appendFileSync(outputFile, `  chunk_${chunk}:\n`);
  fs.appendFileSync(outputFile, `    needs: npm-intstall\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 30\n`);
  fs.appendFileSync(outputFile, `    env:\n`);
  fs.appendFileSync(outputFile, `      FIREBASE_TOKEN: \${{ secrets.FIREBASE_DEV_TOKEN }}\n`);
  fs.appendFileSync(outputFile, `    steps:\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/checkout@v3\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/setup-node@v3\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          node-version: '16'\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/cache@v3\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          path: |\n`);
  fs.appendFileSync(outputFile, `           node_modules\n`);
  fs.appendFileSync(outputFile, `           packages/functions/node_modules\n`);
  fs.appendFileSync(outputFile, `           packages/functions/lib\n`);
  fs.appendFileSync(outputFile, `           packages/interfaces/node_modules\n`);
  fs.appendFileSync(outputFile, `           packages/interfaces/lib\n`);
  fs.appendFileSync(
    outputFile,
    `          key: \${{ runner.os }}-modules-\${{ hashFiles('**/package.json') }}\n`,
  );

  fs.appendFileSync(outputFile, `      - name: Init\n`);
  fs.appendFileSync(outputFile, `        run: |\n`);
  fs.appendFileSync(outputFile, `          npm install -g firebase-tools@11.14.1\n`);
  fs.appendFileSync(outputFile, `          npm install -g npm-run-all\n`);

  fs.appendFileSync(outputFile, `      - name: Test\n`);
  fs.appendFileSync(outputFile, `        working-directory: packages/functions\n`);

  fs.appendFileSync(outputFile, `        run: firebase emulators:exec \n`);
  fs.appendFileSync(outputFile, `             "run-p \n`);
  for (const file of files) {
    fs.appendFileSync(
      outputFile,
      `             \\"${commandName} -- --findRelatedTests ${file}\\" \n`,
    );
  }
  fs.appendFileSync(outputFile, `             " --project dev\n\n`);
}

function createTangleTest() {
  setup(tangleTestFile, tangleTestFileName);
  init(tangleTestFile);
  const files = glob.sync(`./test-tangle/**/*.spec.ts`);
  const only = files.filter((f) => f.includes('only.spec.ts'));
  const rest = files.filter((f) => !f.includes('only.spec.ts'));
  const restChunks = chunk(rest, 3);
  restChunks.forEach((chunk, i) => job(tangleTestFile, i, chunk, 'test-tangle'));
  chunk(only, 1).forEach((chunk, i) =>
    job(tangleTestFile, i + restChunks.length, chunk, 'test-tangle'),
  );
}

function createTangleOnlineTest() {
  setupOnline(tangleOnlineTestFile, tangleOnlineTestFileName);
  init(tangleOnlineTestFile);
  const files = glob.sync(`./test-tangle/**/*.spec.ts`).filter((f) => !f.includes('only.spec.ts'));
  chunk(files, 3).forEach((chunk, i) => job(tangleOnlineTestFile, i, chunk, 'test-tangle-online'));
}

function createEmulatedTest() {
  setup(emulatedTestFile, emulatedTestFileName);
  init(emulatedTestFile);
  const files = glob.sync(`./test/**/*.spec.ts`);
  chunk(files, 5).forEach((chunk, i) => job(emulatedTestFile, i, chunk, 'test'));
}

function createEmulatedOnlineTest() {
  setupOnline(emulatedOnlineTestFile, emulatedOnlineTestFileName);
  init(emulatedOnlineTestFile);
  const files = glob.sync(`./test/**/*.spec.ts`);
  chunk(files, 5).forEach((chunk, i) => job(emulatedOnlineTestFile, i, chunk, 'test-online'));
}

createTangleTest();
createEmulatedTest();
createTangleOnlineTest();
createEmulatedOnlineTest();
