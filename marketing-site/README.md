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

### 1. Create an S3 bucket

```bash
aws s3 mb s3://greenlights-marketing --region us-east-1
```

### 2. Enable static website hosting

```bash
aws s3 website s3://greenlights-marketing \
  --index-document index.html \
  --error-document 404.html
```

### 3. Upload the build

```bash
npm run build
aws s3 sync out/ s3://greenlights-marketing --delete
```

### 4. Create a CloudFront distribution

Point the distribution origin to the S3 bucket website endpoint. Configure:

- **Default root object**: `index.html`
- **Custom error response**: 404 → `/404.html` (200 status)
- **Cache behavior**: cache static assets (`_next/static/*`) with long TTL
- **HTTPS**: attach an ACM certificate for your domain

### 5. Invalidate cache after deploys

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
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
