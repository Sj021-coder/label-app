/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // Allow phones/tablets on the local network to load the dev server's
  // internal /_next/* assets (HMR, JS chunks). Without this, cross-origin
  // access to those resources is blocked and the page renders but never
  // hydrates — i.e. "not interactive". Dev-only; ignored in production.
  allowedDevOrigins: ["192.168.1.63", "192.168.1.94"],
};

export default nextConfig;
