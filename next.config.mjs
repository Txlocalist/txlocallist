import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    localPatterns: [
      {
        pathname: "/api/blob-image",
      },
      {
        pathname: "/addvertise-1.webp",
      },
      {
        pathname: "/welcome.webp",
      },
      {
        pathname: "/cowboy.webp",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
