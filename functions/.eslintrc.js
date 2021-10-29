module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    "project": ["tsconfig.*?.json"],
    "createDefaultProgram": true,
    "sourceType": "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "import/no-unresolved": 0,
    "import/extensions": 0,
    "valid-jsdoc": 0,
    // Disabled for now.
    "require-jsdoc": 0 // ["error", {
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
