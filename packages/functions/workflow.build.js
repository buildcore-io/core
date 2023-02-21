const glob = require('glob');
const fs = require('fs');
const { chunk } = require('lodash');

const tangleTestFile = '../../.github/workflows/functions_tangle-unit-tests.yml';
const tangleOnlineTestFile =
  '../../.github/workflows/functions_tangle-online-unit-tests_emulator.yml';
const emulatedTestFile = '../../.github/workflows/functions_emulated-tests.yml';
const emulatedOnlineTestFile = '../../.github/workflows/functions_online-emulated-tests.yml';

const tangleTestFileName = 'Functions | Tangle - Emulated Unit Tests';
const tangleOnlineTestFileName = 'Functions | Tangle - Online - Emulated Unit Tests';
const emulatedTestFileName = 'Functions | Emulated Unit Tests';
const emulatedOnlineTestFileName = 'Functions | Online Emulated Unit Tests';

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
  fs.appendFileSync(outputFile, '  npm-install:\n');
  fs.appendFileSync(outputFile, '    runs-on: ubuntu-latest\n');
  fs.appendFileSync(outputFile, '    timeout-minutes: 10\n');
  fs.appendFileSync(outputFile, '    steps:\n');
  // Foresight telemetry
  fs.appendFileSync(outputFile, '      - name: Collect Workflow Telemetry\n');
  fs.appendFileSync(outputFile, '        uses: runforesight/foresight-workflow-kit-action@v1\n');
  fs.appendFileSync(outputFile, '        if: ${{ always() }}\n');
  fs.appendFileSync(outputFile, '        with:\n');
  fs.appendFileSync(outputFile, '          api_key: ${{ secrets.FORESIGHT_KEY }}\n');
  // end
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
  fs.appendFileSync(outputFile, '           packages/interfaces/node_modules\n');
  fs.appendFileSync(
    outputFile,
    "          key: ${{ runner.os }}-modules-${{ hashFiles('**/package.json') }}\n",
  );
  fs.appendFileSync(outputFile, '      - name: Install Dependencies\n');
  fs.appendFileSync(outputFile, "        if: steps.cache.outputs.cache-hit != 'true'\n");
  fs.appendFileSync(
    outputFile,
    '        run: npx lerna bootstrap --scope=@soonaverse/functions\n\n',
  );
}

function job(outputFile, chunk, files, commandName) {
  fs.appendFileSync(outputFile, `  chunk_${chunk}:\n`);
  fs.appendFileSync(outputFile, `    needs: npm-install\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 20\n`);
  fs.appendFileSync(outputFile, `    env:\n`);
  fs.appendFileSync(outputFile, `      FIREBASE_TOKEN: \${{ secrets.FIREBASE_DEV_TOKEN }}\n`);
  fs.appendFileSync(outputFile, `    steps:\n`);
  // Foresight telemetry
  fs.appendFileSync(outputFile, '      - name: Collect Workflow Telemetry\n');
  fs.appendFileSync(outputFile, '        uses: runforesight/foresight-workflow-kit-action@v1\n');
  fs.appendFileSync(outputFile, '        if: ${{ always() }}\n');
  fs.appendFileSync(outputFile, '        with:\n');
  fs.appendFileSync(outputFile, '          api_key: ${{ secrets.FORESIGHT_KEY }}\n');
  // end
  fs.appendFileSync(outputFile, `      - uses: actions/checkout@v3\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/setup-node@v3\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          node-version: '16'\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/cache@v3\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          path: |\n`);
  fs.appendFileSync(outputFile, `           node_modules\n`);
  fs.appendFileSync(outputFile, `           packages/functions/node_modules\n`);
  fs.appendFileSync(outputFile, `           packages/interfaces/node_modules\n`);
  fs.appendFileSync(
    outputFile,
    `          key: \${{ runner.os }}-modules-\${{ hashFiles('**/package.json') }}\n`,
  );

  fs.appendFileSync(outputFile, `      - name: Init\n`);
  fs.appendFileSync(outputFile, `        run: |\n`);
  fs.appendFileSync(outputFile, `          npm run build:functions\n`);
  fs.appendFileSync(outputFile, `          npm install -g firebase-tools@11.14.1\n`);
  fs.appendFileSync(outputFile, `          npm install -g npm-run-all\n`);

  fs.appendFileSync(outputFile, `      - name: Test\n`);
  fs.appendFileSync(outputFile, `        working-directory: packages/functions\n`);
  fs.appendFileSync(
    outputFile,
    `        run: npm run milestone-sync & firebase emulators:exec "\n`,
  );
  files.forEach((file, index) => {
    fs.appendFileSync(
      outputFile,
      `                npm run ${commandName}:ci -- --findRelatedTests ${file} ${
        index < files.length - 1 ? '&&' : ''
      }\n`,
    );
  });
  fs.appendFileSync(outputFile, `             " --project dev --export-on-exit=./firestore-data\n`);
  // Test reports collection via github action.
  // fs.appendFileSync(outputFile, `      - name: Test Report\n`);
  // fs.appendFileSync(
  //   outputFile,
  //   `        uses: phoenix-actions/test-reporting@f68b7c5fcffefd98dd230c686cca6c26683668c3\n`,
  // );
  // fs.appendFileSync(outputFile, `        if: success() || failure()\n`);
  // fs.appendFileSync(outputFile, `        with:\n`);
  // fs.appendFileSync(outputFile, `          name: Tests results - chunk_${chunk}\n`);
  // fs.appendFileSync(outputFile, `          path: packages/functions/reports/junit-*.xml\n`);
  // fs.appendFileSync(outputFile, `          output-to: checks\n`);
  // fs.appendFileSync(outputFile, `          reporter: jest-junit\n\n`);

  // Coverage & test results via foresight
  fs.appendFileSync(outputFile, `      - name: Archive firestore data\n`);
  fs.appendFileSync(outputFile, `        uses: actions/upload-artifact@v3\n`);
  fs.appendFileSync(outputFile, '        if: ${{ failure() }}\n');
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `           name: firestore-data-${commandName}-chunk_${chunk}\n`);
  fs.appendFileSync(outputFile, `           path: ./packages/functions/firestore-data/\n`);
  fs.appendFileSync(outputFile, `           retention-days: 1\n`);

  fs.appendFileSync(outputFile, `      - name: Analyze Test and Coverage Results\n`);
  fs.appendFileSync(outputFile, `        uses: runforesight/foresight-test-kit-action@v1\n`);
  fs.appendFileSync(outputFile, `        if: \${{ always() }}\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          api_key: \${{ secrets.FORESIGHT_KEY }}\n`);
  fs.appendFileSync(outputFile, `          test_format: JUNIT\n`);
  fs.appendFileSync(outputFile, `          test_framework: JEST\n`);
  fs.appendFileSync(outputFile, `          test_path: packages/functions/reports/test\n`);
  fs.appendFileSync(outputFile, `          coverage_format: COBERTURA/XML\n`);
  fs.appendFileSync(outputFile, `          coverage_path: packages/functions/reports/coverage\n\n`);
}

const tangleChunkSize = 4;
const emulatorChunkSize = 7;

function createTangleTest() {
  setup(tangleTestFile, tangleTestFileName);
  init(tangleTestFile);
  const files = glob.sync(`./test-tangle/**/*.spec.ts`);
  const only = files.filter((f) => f.includes('only.spec.ts'));
  const rest = files.filter((f) => !f.includes('only.spec.ts'));
  const restChunks = chunk(rest, tangleChunkSize);
  restChunks.forEach((chunk, i) => job(tangleTestFile, i, chunk, 'test-tangle'));
  chunk(only, 1).forEach((chunk, i) =>
    job(tangleTestFile, i + restChunks.length, chunk, 'test-tangle'),
  );
}

function createTangleOnlineTest() {
  setupOnline(tangleOnlineTestFile, tangleOnlineTestFileName);
  init(tangleOnlineTestFile);
  const files = glob
    .sync(`./test-tangle/**/*.spec.ts`)
    .filter((f) => !f.includes('only.spec.ts'))
    .filter((f) => !f.includes('web3.spec'))
    .filter((f) => !f.includes('dbRoll'));
  chunk(files, tangleChunkSize).forEach((chunk, i) =>
    job(tangleOnlineTestFile, i, chunk, 'test-tangle-online'),
  );
}

function createEmulatedTest() {
  setup(emulatedTestFile, emulatedTestFileName);
  init(emulatedTestFile);
  const files = glob.sync(`./test/**/*.spec.ts`);
  chunk(files, emulatorChunkSize).forEach((chunk, i) => job(emulatedTestFile, i, chunk, 'test'));
}

function createEmulatedOnlineTest() {
  setupOnline(emulatedOnlineTestFile, emulatedOnlineTestFileName);
  init(emulatedOnlineTestFile);
  const files = glob
    .sync(`./test/**/*.spec.ts`)
    .filter((f) => !f.includes('only.spec.ts'))
    .filter((f) => !f.includes('dbRoll'));
  chunk(files, emulatorChunkSize).forEach((chunk, i) =>
    job(emulatedOnlineTestFile, i, chunk, 'test-online'),
  );
}

createTangleTest();
createEmulatedTest();
createTangleOnlineTest();
createEmulatedOnlineTest();
