module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 520000,
  globals: {
    'ts-jest': {
      "diagnostics": {
        "ignoreCodes": [2571, 6031, 18003]
      }
    },
  }
};
