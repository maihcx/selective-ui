import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'jsdom',

    preset: 'ts-jest',

    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

    testMatch: [
        '<rootDir>/tests/**/*.test.ts',
        '<rootDir>/tests/**/*.spec.ts'
    ],

    transform: {
        '^.+\\.ts$': 'ts-jest'
    },

    collectCoverageFrom: [
        'src/ts/**/*.ts',
        '!src/ts/**/*.d.ts',
        '!src/ts/**/*.type.ts'
    ],

    coverageDirectory: 'coverage',

    coverageReporters: ['text', 'lcov', 'html'],

    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },

    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/ts/$1',
        '^src/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.ts'
    },

    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
    ],

    verbose: true,
    testTimeout: 10000
};

export default config;
