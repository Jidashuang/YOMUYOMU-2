import { defineConfig, globalIgnores } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default defineConfig([
  ...coreWebVitals,
  ...typescript,
  {
    // mount 后水合 localStorage、异步数据返回后恢复阅读位置，都是 React 官方
    // 认可的“effect 同步外部状态”用法，不作为错误阻塞 lint。
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    ".next-playwright/**",
    "next-env.d.ts",
  ]),
]);
