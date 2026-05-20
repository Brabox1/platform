/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@checkout/db", "@checkout/amplopay"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
