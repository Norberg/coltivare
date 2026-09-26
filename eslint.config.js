import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
export default ts.config(js.configs.recommended, ...ts.configs.recommended, {
  languageOptions: {
    globals: { ...globals.browser, ...globals.node, ...globals.jest },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
});
