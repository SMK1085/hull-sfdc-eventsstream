module.exports = {
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  testPathIgnorePatterns: [
    "/lib/",
    "/node_modules/",
    "/build/",
    "/build-types/",
    "/_data",
    "/_helpers",
    "/_scenarios",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  collectCoverage: true,
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  collectCoverageFrom: [
    "src/core/**",
    "src/utils/**",
    "!src/utils/**/auth-middleware.ts",
    "!src/utils/**/redis-client.ts",
    "!src/utils/**/redis-middleware.ts",
    "!src/core/service-objects.ts",
  ],
};
