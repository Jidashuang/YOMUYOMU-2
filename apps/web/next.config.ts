import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@yomuyomu/shared-types", "@yomuyomu/ui"],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: path.resolve(configDir, "../../"), // 指向 monorepo 根 yomuyomu/
  },
};

export default nextConfig;
