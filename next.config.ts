import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",            value: "DENY" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security",  value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // App + Vercel Analytics + TradingView widget loader + Google Identity (GIS) + Google API client
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://s3.tradingview.com https://accounts.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              // API endpoints: Supabase, market data, TradingView feeds, Google Sheets/Drive/OAuth
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.coingecko.com https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://api.twelvedata.com https://finnhub.io https://api.bybit.com https://va.vercel-scripts.com https://*.tradingview.com https://sheets.googleapis.com https://www.googleapis.com https://content.googleapis.com https://accounts.google.com",
              // Embedded iframes: TradingView charts + Google Sheets preview + Google OAuth popup
              "frame-src 'self' https://*.tradingview.com https://www.tradingview.com https://s.tradingview.com https://docs.google.com https://accounts.google.com https://content.googleapis.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
