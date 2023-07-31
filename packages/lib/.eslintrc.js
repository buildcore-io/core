module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json'],
    createDefaultProgram: true,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
  ],
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    '@typescript-eslint/no-explicit-any': 2,
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/no-non-null-asserted-optional-chain': 0,
    'import/no-unresolved': 0,
    'valid-jsdoc': 0,
    indent: 0,
    'no-invalid-this': 2,
    'use-isnan': 2,
    '@typescript-eslint/await-thenable': 2,
    '@typescript-eslint/no-misused-new': 2,
    'space-before-blocks': 2,
    '@typescript-eslint/type-annotation-spacing': 2,
    'comma-spacing': 2,
    'no-multi-spaces': 2,
    'no-multiple-empty-lines': 2,
    '@typescript-eslint/prefer-enum-initializers': 2,
    '@typescript-eslint/member-delimiter-style': 2,
    // Disabled for now.
    'require-jsdoc': 0, // ["error", {
    //   "require": {
    //       "FunctionDeclaration": true,
    //       "MethodDefinition": true,
    //       "ClassDeclaration": true,
    //       "ArrowFunctionExpression": true,
    //       "FunctionExpression": true
    //   }
    // }]
  },
};
