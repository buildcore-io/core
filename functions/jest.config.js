module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 25000,
  globalSetup: "./test/reset-db.mjs",
  globals: {
    'ts-jest': {
      "diagnostics": {
        "ignoreCodes": [2571, 6031, 18003]
      }
    },
  }
};
