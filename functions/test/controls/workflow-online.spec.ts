import fs from 'fs';
import glob from 'glob';

describe('Workflow test', () => {

  it('Test if workflow contains all files', async () => {
    const buffer = fs.readFileSync('../.github/workflows/online-functions-unit-tests_emulator.yml');
    const workflowTxt = buffer.toString();

    const testFileNames = glob.sync(`./test/**/*.spec.ts`)
    for (const testFileName of testFileNames) {
      const fileName = testFileName.replace('./test/controls/', '').replace(/\./g, "-")
      if (!workflowTxt.includes(fileName)) {
        throw Error(`functions-unit-tests_emulator.yml misses the following file: ${testFileName}. Pls run node workflow.build.js`)
      }
    }
  })
})