# Greenlights Marketing Site

Static marketing website built with Next.js 14, TypeScript, and Tailwind CSS. Exports as static HTML for deployment to S3 + CloudFront.

## Prerequisites

- Node.js 18+
- npm

## Development

```bash
cd marketing-site
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000) with hot reload.

## Production Build

```bash
npm run build
```

This generates a fully static site in the `out/` directory. All pages are pre-rendered as HTML — no Node.js server is needed in production.

Preview the production build locally:

```bash
npx serve out
```

## Deploy to AWS (S3 + CloudFront)

### 1. Upload the build

```bash
npm run build
aws s3 sync out/ s3://greenlights-marketing --delete
```

### 2. Invalidate cache after deploys

```bash
aws cloudfront create-invalidation --distribution-id E2MYC3DESXWUAT --paths "/*"
```

## Project Structure

```
marketing-site/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout (fonts, metadata)
│   │   └── page.tsx        # Homepage (composes all sections)
│   └── components/
│       ├── Navbar.tsx       # Fixed navigation bar
│       ├── Hero.tsx         # Hero section with CTAs
│       ├── Features.tsx     # Feature grid
│       ├── Connectors.tsx   # Integration partners
│       ├── Architecture.tsx # High-level architecture diagram
│       ├── Benefits.tsx     # Key benefits
│       ├── Pricing.tsx      # Pricing card
│       ├── CTA.tsx          # Demo request form
│       └── Footer.tsx       # Footer with links
├── next.config.mjs         # Static export configuration
├── tailwind.config.ts       # Custom brand color palette
└── package.json
```
