import fs from 'fs';

describe('Workflow test', () => {
  it('Test if workflow contains all files', async () => {
    const buffer = fs.readFileSync(
      '../../.github/workflows/functions_tangle-online-unit-tests_emulator.yml',
    );
    const workflowTxt = buffer.toString();

    const glob = require('glob');
    const testFileNames = glob
      .sync(`./test-tangle/**/*.spec.ts`)
      .filter((f: any) => !f.includes('exclude'))
      .filter((f: any) => !f.includes('only.spec.ts'))
      .filter((f: any) => !f.includes('web3.spec'))
      .filter((f: any) => !f.includes('dbRoll'));
    for (const testFileName of testFileNames) {
      if (!workflowTxt.includes(testFileName)) {
        throw Error(
          `Action misses the following file: ${testFileName}. Pls run node workflow-online.build.js`,
        );
      }
    }
  });
});
