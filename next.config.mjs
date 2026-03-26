/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // ESM-only SDK; required for dev (especially Turbopack) to bundle it from node_modules.
  transpilePackages: ["@bitmacro/relay-connect"],
};

export default nextConfig;
