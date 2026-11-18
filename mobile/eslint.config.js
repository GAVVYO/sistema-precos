// Lint próprio do app (o do site ignora mobile/).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*"] },
  {
    // "@/" e "@core/" são resolvidos pelo Metro (metro.config.js) e pelo tsconfig.
    settings: { "import/resolver": { typescript: { project: "./tsconfig.json" } } },
    rules: { "import/no-unresolved": "off" },
  },
]);
