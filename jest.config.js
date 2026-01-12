module.exports = {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // Test match patterns
    testMatch: [
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/tests/**/*.spec.js'
    ],
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.type.ts',
        '!src/ts/index.ts'
    ],
    
    coverageDirectory: 'coverage',
    
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],
    
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // Module paths
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js'
    },
    
    // Transform files
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
    ],
    
    // Verbose output
    verbose: true,
    
    // Timeout
    testTimeout: 10000
};