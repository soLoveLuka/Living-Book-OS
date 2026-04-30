import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === "production" ? "/Living-Book-OS" : "",
  assetPrefix: process.env.NODE_ENV === "production" ? "/Living-Book-OS/" : "",
};

export default nextConfig;
