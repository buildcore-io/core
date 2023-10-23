import { convertFromDirectory } from 'joi-to-typescript';

convertFromDirectory({
  schemaDirectory: './packages/functions/src/controls/',
  typeOutputDirectory: './packages/interfaces/src/api/post/',
  flattenTree: true,
});
