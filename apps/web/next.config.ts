import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@yomuyomu/shared-types", "@yomuyomu/ui"],
  turbopack: {
    root: path.resolve(__dirname, "../../"), // 指向 monorepo 根 yomuyomu/
  },
};

export default nextConfig;
