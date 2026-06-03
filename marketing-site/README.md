# Greenlights Marketing Site

Dynamic marketing website built with Next.js 14, TypeScript, and Tailwind CSS. Runs as a Node.js server on AWS EC2 behind CloudFront.

## Prerequisites

- Node.js 20+ and npm (local development only)
- Docker (EC2 instance)
- Git (EC2 instance)

## Development

```bash
cd marketing-site
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000) with hot reload.

## Production Build (Docker)

Build and run the image locally to test before deploying:

```bash
docker build -t greenlights-marketing .
docker run -p 3000:3000 greenlights-marketing
```

Opens at [http://localhost:3000](http://localhost:3000).

## Deploy to AWS EC2

### First-time setup on the EC2 instance

SSH into the instance, then install Git and Docker:

```bash
sudo apt update && sudo apt install -y git docker.io
sudo systemctl enable docker
sudo usermod -aG docker ubuntu   # log out and back in after this
```

Clone the repository:

```bash
git clone https://github.com/ccarnus/wms.git
cd wms/marketing-site
```

Build and start the container:

```bash
docker build -t greenlights-marketing .
docker run -d \
  --name greenlights-marketing \
  --restart=always \
  -p 3000:3000 \
  greenlights-marketing
```

The app listens on port 3000. Nginx on the host proxies port 80 → 3000 (see Nginx config below).

### Re-deploying after code changes

SSH into the instance, then:

```bash
cd wms/marketing-site
git pull

docker build -t greenlights-marketing .

docker stop greenlights-marketing && docker rm greenlights-marketing

docker run -d \
  --name greenlights-marketing \
  --restart=always \
  -p 3000:3000 \
  greenlights-marketing
```

### Nginx reverse proxy (on EC2)

Install Nginx and drop this config at `/etc/nginx/conf.d/greenlights.conf`:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## Project Structure

```
marketing-site/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout (fonts, metadata)
│   │   └── page.tsx         # Homepage (composes all sections)
│   └── components/
│       ├── Navbar.tsx        # Fixed navigation bar
│       ├── Hero.tsx          # Hero section with CTAs
│       ├── Features.tsx      # Feature grid
│       ├── Connectors.tsx    # Integration partners
│       ├── Architecture.tsx  # High-level architecture diagram
│       ├── Benefits.tsx      # Key benefits
│       ├── Pricing.tsx       # Pricing card
│       ├── CTA.tsx           # Demo request form
│       └── Footer.tsx        # Footer with links
├── Dockerfile               # Multi-stage production build
├── next.config.mjs          # Next.js standalone server config
├── tailwind.config.ts       # Custom brand color palette
└── package.json
```
