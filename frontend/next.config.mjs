import { fileURLToPath } from 'node:url';

const backendOrigin = (process.env.BACKEND_ORIGIN ||
  (process.env.NODE_ENV === 'production'
    ? 'https://ghc-ecom-production.up.railway.app'
    : 'http://127.0.0.1:3001')).replace(/\/+$/, '');
const developmentEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
const isManagedPlatformBuild =
  process.env.VERCEL === '1' || Boolean(process.env.NEXT_ADAPTER_PATH);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${developmentEval} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "connect-src 'self' https://*.razorpay.com https://*.razorpay.in",
  "frame-src https://www.instagram.com https://*.razorpay.com https://*.razorpay.in",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: fileURLToPath(new URL('..', import.meta.url)),
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Vercel's Next.js adapter owns output tracing and deployment packaging.
  // Keep standalone output only for the Docker/self-hosted build.
  ...(!isManagedPlatformBuild && { output: 'standalone' }),
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
