/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }]
  },
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }]
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1'
      }
    },
    {
      displayName: 'integration', 
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }]
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1'
      }
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.e2e.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      testTimeout: 30000,
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }]
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1'
      }
    }
  ],
  collectCoverageFrom: [
    'server/**/*.ts', 
    'shared/**/*.ts',
    '!server/**/*.d.ts',
    '!server/**/*.test.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      lines: 70
    }
  },
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  }
};