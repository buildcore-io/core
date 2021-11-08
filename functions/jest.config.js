module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      "diagnostics": {
        "ignoreCodes": [2571, 6031, 18003]
      }
    },
  }
};
