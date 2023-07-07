import { convertFromDirectory } from 'joi-to-typescript';

convertFromDirectory({
  schemaDirectory: './packages/functions/src/runtime/firebase/',
  typeOutputDirectory: './packages/interfaces/src/api/post/',
  flattenTree: true,
});
