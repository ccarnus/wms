/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  staticPageGenerationTimeout: 300,
};

export default nextConfig;
