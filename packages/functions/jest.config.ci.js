module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 900000,
  globalSetup: './test/set-up.ts',
  globalTeardown: './test/teardown.ts',
  reporters: [
    'default',
    'github-actions',
    ['jest-junit', { outputDirectory: 'reports/test', outputName: 'junit-report.xml' }],
  ],
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '<rootDir>/test/',
    '<rootDir>/test-tangle',
    '<rootDir>/scripts',
    '<rootDir>/lib',
    '<rootDir>/reports',
    '<rootDir>/node_modules/',
  ],
  coverageDirectory: 'reports/coverage',
  coverageReporters: ['cobertura'],
};
