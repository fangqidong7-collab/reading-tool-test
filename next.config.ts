import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),  // Uncomment and add 'import path from "path"' if needed
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    // pdfjs-dist tries to require 'canvas' which is a Node-only module
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
