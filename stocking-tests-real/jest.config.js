export default {
  roots: ["<rootDir>/__tests__"],
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", useESM: true }]
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  reporters: ["default", ["jest-junit", { outputDirectory: "<rootDir>/out", outputName: "jest-junit.xml" }]],
  coverageDirectory: "<rootDir>/out/coverage",
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "<rootDir>/__tests__/**/*.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.cjs"],
  extensionsToTreatAsEsm: [".ts"],
  maxWorkers: 1
};
