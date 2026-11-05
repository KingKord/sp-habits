import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "output/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    rules: {
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": ["error", { caughtErrors: "none", argsIgnorePattern: "^_" }]
    }
  },
  { files: ["src/**/*.js"], languageOptions: { globals: globals.browser } },
  {
    files: ["src/domain.js", "src/store.js"],
    rules: {
      "no-restricted-globals": ["error", "window", "document", "PluginAPI"],
      "no-restricted-imports": ["error", { patterns: ["./ui/**", "./host/**", "./application.js"] }]
    }
  },
  // Domain validation intentionally rejects control characters in user input.
  { files: ["src/domain.js"], rules: { "no-control-regex": "off" } },
  { files: ["src/plugin.js"], languageOptions: { globals: { PluginAPI: "readonly" } } },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "eslint.config.js"],
    languageOptions: { globals: globals.node }
  }
];
