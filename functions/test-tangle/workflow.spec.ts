import fs from 'fs';
import glob from 'glob';

describe('Workflow test', () => {
  it('Test if workflow contains all files', async () => {
    const buffer = fs.readFileSync('../.github/workflows/tangle-functions-unit-tests.yml');
    const workflowTxt = buffer.toString();

    const testFileNames = glob.sync(`./test-tangle/**/*.spec.ts`);
    for (const testFileName of testFileNames) {
      if (!workflowTxt.includes(testFileName)) {
        throw Error(
          `functions-unit-tests_emulator.yml misses the following file: ${testFileName}. Pls run node workflow.build.js`,
        );
      }
    }
  });
});
