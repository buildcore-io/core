module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 900000,
  globalSetup: './test/set-up.ts',
  reporters: ['default', 'github-actions'],
};
