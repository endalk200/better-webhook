import { config } from "@better-webhook/eslint-config/base";

export default [
  ...config,
  {
    ignores: [".next/**"],
  },
];
