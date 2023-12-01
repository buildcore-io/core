import { convertFromDirectory } from 'joi-to-typescript';

convertFromDirectory({
  schemaDirectory: './packages/functions/src/controls/',
  typeOutputDirectory: './packages/interfaces/src/search/post/',
  flattenTree: true,
});
