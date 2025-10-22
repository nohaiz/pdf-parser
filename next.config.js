/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip type checking for Supabase Edge Functions during build
  typescript: {
    // This will skip type checking during build
    // We exclude supabase directory in tsconfig.json
    ignoreBuildErrors: false,
  },
  // Exclude Supabase functions from webpack compilation
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/functions/**', '**/node_modules/**'],
    };
    return config;
  },
}

module.exports = nextConfig

