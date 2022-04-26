module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 520000,
  globalTeardown: "./test/reset-db.mjs",
  globals: {
    'ts-jest': {
      "diagnostics": {
        "ignoreCodes": [2571, 6031, 18003]
      }
    },
  }
};
