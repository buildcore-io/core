import fs from 'fs';

describe('Workflow test', () => {
  it('Test if workflow contains all files', async () => {
    const buffer = fs.readFileSync('../../.github/workflows/functions_tangle-unit-tests.yml');
    const workflowTxt = buffer.toString();

    const glob = require('glob');
    const testFileNames = glob
      .sync(`./test-tangle/**/*.spec.ts`)
      .filter((f: any) => !f.includes('exclude'));
    for (const testFileName of testFileNames) {
      if (!workflowTxt.includes(testFileName)) {
        throw Error(
          `Action misses the following file: ${testFileName}. Pls run node workflow.build.js`,
        );
      }
    }
  });
});
