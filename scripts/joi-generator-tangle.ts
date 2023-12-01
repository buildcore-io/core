import { convertFromDirectory } from 'joi-to-typescript';

convertFromDirectory({
  schemaDirectory: './packages/functions/src/services/payment/tangle-service/',
  typeOutputDirectory: './packages/interfaces/src/search/tangle/',
  flattenTree: true,
});
