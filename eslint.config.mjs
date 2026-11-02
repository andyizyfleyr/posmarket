import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Convention du dépôt : un paramètre volontairement ignoré est préfixé
      // par `_` (ex. `_userId`, `_opts` dans les server actions).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    /**
     * Application mobile (React Native / Expo).
     *
     * Les règles `jsx-a11y/alt-text` et `@next/next/no-img-element` sont des
     * règles du web : elles exigeaient `alt` sur des `<Image>` de `expo-image`
     * (qui utilise `accessibilityLabel` et `alt` uniquement depuis Expo SDK 51+)
     * et interdisaient `<img>`, qui n'existe pas hors DOM. Elles produisaient
     * 28 faux positifs qui masquaient les vrais avertissements.
     */
    files: ["posmarket-mobile/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/alt-text": "off",
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["tests/k6/**/*.js"],
    rules: {
      // k6 n'exécute que le `export default function () {}` : le nom de la
      // fonction n'a aucun intérêt, la règle est inapplicable ici.
      "import/no-anonymous-default-export": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
