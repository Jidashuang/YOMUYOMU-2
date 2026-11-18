import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep browser tests from sharing the running preview's dev lock and output.
  distDir: process.env.PLAYWRIGHT_TEST === "1" ? ".next-playwright" : ".next",
  transpilePackages: ["@yomuyomu/shared-types", "@yomuyomu/ui"],
  turbopack: {
    root: path.resolve(configDir, "../../"), // 指向 monorepo 根 yomuyomu/
  },
};

export default nextConfig;
