import fs from 'fs';
import glob from 'glob';

describe('Workflow test', () => {
  it('Test if workflow contains all files', async () => {
    const buffer = fs.readFileSync(
      '../../.github/workflows/functions_tangle-online-unit-tests_emulator.yml',
    );
    const workflowTxt = buffer.toString();

    const testFileNames = glob
      .sync(`./test-tangle/**/*.spec.ts`)
      .filter((f) => !f.includes('only.spec.ts'))
      .filter((f) => !f.includes('web3.spec'));
    for (const testFileName of testFileNames) {
      if (!workflowTxt.includes(testFileName)) {
        throw Error(
          `Action misses the following file: ${testFileName}. Pls run node workflow-online.build.js`,
        );
      }
    }
  });
});
