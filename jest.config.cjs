module.exports = {
  preset: "ts-jest",
  cacheDirectory: "<rootDir>/.cache/jest",
  testEnvironment: "jsdom",
  testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.test.tsx"],
  setupFiles: ["fake-indexeddb/auto", "<rootDir>/tests/setup.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { module: "CommonJS", moduleResolution: "Node" } },
    ],
  },
};
