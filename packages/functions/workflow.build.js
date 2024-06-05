const glob = require('glob');
const fs = require('fs');
const { chunk } = require('lodash');

const tangleTestFile = '../../.github/workflows/functions_tangle-unit-tests.yml';
('../../.github/workflows/functions_tangle-online-unit-tests_emulator.yml');
const emulatedTestFile = '../../.github/workflows/functions_emulated-tests.yml';

const tangleTestFileName = 'Functions | Tangle - Emulated Unit Tests';
const emulatedTestFileName = 'Functions | Emulated Unit Tests';

function setup(outputFile, title) {
  fs.writeFileSync(outputFile, `name: ${title}\n\n`);
  fs.appendFileSync(outputFile, 'on:\n');
  fs.appendFileSync(outputFile, '  pull_request:\n');
  fs.appendFileSync(outputFile, '    paths:\n');
  fs.appendFileSync(outputFile, '      - packages/functions/**\n');
  fs.appendFileSync(outputFile, '      - packages/database/**\n\n');
}

function init(outputFile) {
  fs.appendFileSync(outputFile, 'jobs:\n');
  fs.appendFileSync(outputFile, '  npm-install:\n');
  fs.appendFileSync(outputFile, '    runs-on: ubuntu-latest\n');
  fs.appendFileSync(outputFile, '    timeout-minutes: 10\n');

  fs.appendFileSync(outputFile, '    steps:\n');
  fs.appendFileSync(outputFile, '      - uses: actions/checkout@v4\n');
  fs.appendFileSync(outputFile, '      - uses: actions/setup-node@v4\n');
  fs.appendFileSync(outputFile, '        with:\n');
  fs.appendFileSync(outputFile, '          node-version: 20.x\n');
  fs.appendFileSync(outputFile, '      - uses: actions/cache@v4\n');
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
  fs.appendFileSync(outputFile, '        run: npm run build:functions\n\n');
}

function job(outputFile, chunk, files) {
  fs.appendFileSync(outputFile, `  chunk_${chunk}:\n`);
  fs.appendFileSync(outputFile, `    needs: npm-install\n`);
  fs.appendFileSync(outputFile, `    environment: development\n`);
  fs.appendFileSync(outputFile, `    runs-on: ubuntu-latest\n`);
  fs.appendFileSync(outputFile, `    timeout-minutes: 20\n\n`);

  fs.appendFileSync(outputFile, '    services:\n');
  fs.appendFileSync(outputFile, '      postgres:\n');
  fs.appendFileSync(outputFile, '        image: postgres\n');
  fs.appendFileSync(outputFile, '        env:\n');
  fs.appendFileSync(outputFile, '          POSTGRES_DB: buildcore\n');
  fs.appendFileSync(outputFile, '          POSTGRES_PASSWORD: postgres\n');
  fs.appendFileSync(outputFile, '          POSTGRES_MAX_CONNECTIONS: 400\n');
  fs.appendFileSync(outputFile, '        ports:\n');
  fs.appendFileSync(outputFile, '          - 5432:5432\n');

  fs.appendFileSync(outputFile, '        options: >-\n');
  fs.appendFileSync(outputFile, '          --health-cmd pg_isready\n');
  fs.appendFileSync(outputFile, '          --health-interval 10s\n');
  fs.appendFileSync(outputFile, '          --health-timeout 5s\n');
  fs.appendFileSync(outputFile, '          --health-retries 5\n\n');

  fs.appendFileSync(outputFile, `    steps:\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/checkout@v4\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/setup-node@v4\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          node-version: 20.x\n`);
  fs.appendFileSync(outputFile, `      - uses: actions/cache@v4\n`);
  fs.appendFileSync(outputFile, `        with:\n`);
  fs.appendFileSync(outputFile, `          path: |\n`);
  fs.appendFileSync(outputFile, `           node_modules\n`);
  fs.appendFileSync(outputFile, `           packages/functions/node_modules\n`);
  fs.appendFileSync(outputFile, `           packages/interfaces/node_modules\n`);
  fs.appendFileSync(
    outputFile,
    `          key: \${{ runner.os }}-modules-\${{ hashFiles('**/package.json') }}\n`,
  );

  fs.appendFileSync(outputFile, `      - name: Set env vars\n`);
  fs.appendFileSync(outputFile, `        working-directory: packages/functions\n`);
  fs.appendFileSync(outputFile, `        run: |\n`);
  fs.appendFileSync(outputFile, `          echo "$ENV_VARS" > .env\n`);
  fs.appendFileSync(outputFile, `          echo "$SERVICE_ACCOUNT" > sa.json\n`);
  fs.appendFileSync(outputFile, `        env:\n`);
  fs.appendFileSync(outputFile, `          ENV_VARS: \${{ secrets.ENV_VARS }}\n`);
  fs.appendFileSync(outputFile, `          SERVICE_ACCOUNT: \${{ secrets.SERVICE_ACCOUNT }}\n`);

  fs.appendFileSync(outputFile, `      - name: Init\n`);
  fs.appendFileSync(outputFile, `        run: npm run build:functions\n`);

  fs.appendFileSync(outputFile, `      - name: Test\n`);
  fs.appendFileSync(outputFile, `        working-directory: packages/functions\n`);
  fs.appendFileSync(outputFile, `        run: |\n`);
  fs.appendFileSync(outputFile, `          npm run start &\n`);
  fs.appendFileSync(outputFile, `          npm run notifier &\n`);

  files.forEach((file, index) => {
    fs.appendFileSync(
      outputFile,
      `          npm run test -- --findRelatedTests --forceExit ${file} ${index < files.length - 1 ? '&&' : ''}\n`,
    );
  });
}

const tangleChunkSize = 3;
const emulatorChunkSize = 7;

function createTangleTest() {
  setup(tangleTestFile, tangleTestFileName);
  init(tangleTestFile);
  const files = glob.sync(`./test-tangle/**/*.spec.ts`).filter((f) => !f.includes('exclude'));
  const only = files.filter((f) => f.includes('only.spec.ts'));
  const rest = files.filter((f) => !f.includes('only.spec.ts'));
  const restChunks = chunk(rest, tangleChunkSize);
  restChunks.forEach((chunk, i) => job(tangleTestFile, i, chunk));
  chunk(only, 1).forEach((chunk, i) => job(tangleTestFile, i + restChunks.length, chunk));
}

function createEmulatedTest() {
  setup(emulatedTestFile, emulatedTestFileName);
  init(emulatedTestFile);
  const files = glob.sync(`./test/**/*.spec.ts`).filter((f) => !f.includes('exclude'));
  chunk(files, emulatorChunkSize).forEach((chunk, i) => job(emulatedTestFile, i, chunk));
}

createTangleTest();
createEmulatedTest();
