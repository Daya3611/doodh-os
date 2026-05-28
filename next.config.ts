/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Forces Next.js to generate static HTML files
  images: {
    unoptimized: true, // Required for static export mode
  },
};
export default nextConfig;
