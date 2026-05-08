import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React 19 の新ルール。マウント検知や props→state 同期など実用的なケースが
      // すべて引っかかるため warning に下げる（フェーズ2でリファクタ予定）。
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
