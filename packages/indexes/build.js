const glob = require('glob');
const fs = require('fs');

const errorMsg = 'Creating firestore.indexes.json failed.';
const successMsg = `firestore.indexes.json file compiled successfully.`;

try {
  const indexFileNames = glob.sync(`./src/**/*.indexes.json`);
  const indexes = indexFileNames.reduce((acc, fileName) => {
    const buffer = fs.readFileSync(fileName);
    const json = JSON.parse(buffer.toString());
    return acc.concat(json.indexes);
  }, []);

  const fieldOverrideFileNames = glob.sync(`./src/**/*.fieldOverrides.json`);
  const fieldOverrides = fieldOverrideFileNames.reduce((acc, fileName) => {
    const buffer = fs.readFileSync(fileName);
    const json = JSON.parse(buffer.toString());
    return acc.concat(json.fieldOverrides);
  }, []);

  fs.writeFileSync('../../firestore.indexes.json', JSON.stringify({ indexes, fieldOverrides }));
  console.log(successMsg);
} catch (e) {
  console.error(errorMsg, e);
}
