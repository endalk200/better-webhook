/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for webhook signature verification
  // This ensures the raw body is available for HMAC verification
  experimental: {
    // Enable if you need additional experimental features
  },
};

export default nextConfig;
