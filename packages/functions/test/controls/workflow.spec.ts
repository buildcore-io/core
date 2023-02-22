import fs from 'fs';
import glob from 'glob';

describe('Workflow test', () => {
  it('Test if workflow contains all files', async () => {
    const buffer = fs.readFileSync('../../.github/workflows/functions_emulated-tests.yml');
    const workflowTxt = buffer.toString();

    const testFileNames = glob.sync(`./test/**/*.spec.ts`).filter((f) => !f.includes('exclude'));
    for (const testFileName of testFileNames) {
      if (!workflowTxt.includes(testFileName)) {
        throw Error(
          `Action misses the following file: ${testFileName}. Pls run node workflow.build.js`,
        );
      }
    }
  });
});
