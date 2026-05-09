/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Previne clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Previne MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Força HTTPS por 1 ano (incluindo subdomínios)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Limita informações no Referer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Desabilita funcionalidades desnecessárias
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // CSP — permite Supabase, Stripe, Meta Pixel, Google Ads
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://connect.facebook.net https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com https://generativelanguage.googleapis.com https://api.anthropic.com https://webservices.esocial.gov.br https://webservices.producaorestrita.esocial.gov.br",
              "frame-src https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
