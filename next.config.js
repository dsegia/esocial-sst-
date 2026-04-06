/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignora erros de TypeScript no build — corrija gradualmente
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora erros de ESLint no build
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
