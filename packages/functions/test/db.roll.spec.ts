import fs from 'fs';

describe('Db roll script test', () => {
  it('All db roll script should have roll function', async () => {
    const glob = require('glob');
    const files = glob.sync(`./scripts/dbUpgrades/**/*.ts`);
    for (const file of files) {
      const content = fs.readFileSync(file);
      expect(content.includes('export const roll = ')).toBe(true);
    }
  });
});
