import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname
});

const eslintConfig = [
  {
    ignores: [".next/**", "coverage/**", "playwright-report/**", "storage/**", "test-results/**"]
  },
  ...compat.extends("next/core-web-vitals")
];

export default eslintConfig;
