module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 900000,
  globalSetup: './jest-setup.ts',
  reporters: ['default', 'github-actions'],
  setupFilesAfterEnv: ['./test/teardown.ts'],
};
