import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@vantrack/shared'],
  poweredByHeader: false,
};
export default config;
