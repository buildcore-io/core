module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 900000,
  globalSetup: './test/set-up.ts',
  globalTeardown: './test/globalTeardown.ts',
  globals: {
    'ts-jest': {
      diagnostics: {
        ignoreCodes: [2571, 6031, 18003],
      },
    },
  },
};
