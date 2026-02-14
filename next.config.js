/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // pdfkit uses readFileSync for font .afm files relative to its own location.
    // Bundling it through webpack breaks those paths. Tell Next.js to require
    // pdfkit natively at runtime instead of bundling it.
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

module.exports = nextConfig;
