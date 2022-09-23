import fs from 'fs';
import glob from 'glob';

describe('Workflow test', () => {

  it('Test if workflow contains all files', async () => {
    const buffer = fs.readFileSync('../.github/workflows/tangle-online-functions-unit-tests_emulator.yml');
    const workflowTxt = buffer.toString();

    const testFileNames = glob.sync(`./test-tangle/**/*.spec.ts`)
    for (const testFileName of testFileNames) {
      const fileName = testFileName
        .replace('./test-tangle/', '')
        .replace(/\//g, "_")
        .replace(/\./g, "-")
      if (!workflowTxt.includes(fileName)) {
        throw Error(`tangle-online-functions-unit-tests_emulator.yml misses the following file: ${testFileName}. Pls run node workflow-online.build.js`)
      }
    }
  })
})