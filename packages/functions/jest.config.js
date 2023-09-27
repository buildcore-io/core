module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 900000,
  globalSetup: './test/set-up.ts',
  globalTeardown: './test/teardown.ts',
  reporters: ['default', 'github-actions'],
};
