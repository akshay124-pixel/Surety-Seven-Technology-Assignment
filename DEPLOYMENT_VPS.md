# VPS Deployment Guide

## Step-by-Step VPS Setup

### 1. Initial Setup (After Git Clone)

```bash
# Navigate to project directory
cd Surety\ Seven\ Technology

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Install Docker & Docker Compose

```bash
# Update packages
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Add user to docker group (to run without sudo)
sudo usermod -aG docker $USER

# Logout and login again, then verify
docker --version
docker compose version
```

### 3. Setup Environment Variables

```bash
# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

**Important: Update these in .env:**
```env
NODE_ENV=production
PORT=3000

# Database (will be created by Docker)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/suretyseven

# Redis (will be created by Docker)
REDIS_URL=redis://redis:6379

# External APIs (using local mock endpoints)
APPLICANT_API_URL=http://api:3000/external/applicants
DOWNSTREAM_API_URL=http://api:3000/external/downstream/events

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Queue settings
QUEUE_EVALUATION_CONCURRENCY=5
QUEUE_NOTIFICATION_CONCURRENCY=3
```

Save and exit (Ctrl+X, then Y, then Enter)

### 4. Build and Run with Docker

```bash
# Build and start all services
docker compose up --build -d

# This will start:
# - PostgreSQL database
# - Redis cache
# - API server (port 3000)
# - Background workers
```

### 5. Check if Services are Running

```bash
# View running containers
docker compose ps

# Check logs
docker compose logs -f api

# Check worker logs
docker compose logs -f worker
```

### 6. Run Database Migrations

```bash
# Run migrations inside the container
docker compose exec api npx prisma migrate deploy

# Verify database
docker compose exec api npx prisma db pull
```

### 7. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/ready

# Test application submission
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicantId": "COMP-123",
    "bondType": "CONTRACT",
    "bondAmount": 500000,
    "effectiveDate": "2026-10-01",
    "obligee": {"name": "Test Company"}
  }'
```

### 8. Setup Firewall (Important!)

```bash
# Allow SSH (don't lock yourself out!)
sudo ufw allow 22

# Allow HTTP
sudo ufw allow 80

# Allow HTTPS
sudo ufw allow 443

# Allow API port
sudo ufw allow 3000

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 9. Setup Nginx Reverse Proxy (Optional but Recommended)

```bash
# Install Nginx
sudo apt-get install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/suretyseven
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/suretyseven /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 10. Setup SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

## Useful Commands

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### View Logs
```bash
# All logs
docker compose logs -f

# API logs only
docker compose logs -f api

# Worker logs only
docker compose logs -f worker

# Last 100 lines
docker compose logs --tail=100 api
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart api
docker compose restart worker
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up --build -d

# Run migrations if needed
docker compose exec api npx prisma migrate deploy
```

### Check Database
```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d suretyseven

# View tables
\dt

# View applications
SELECT * FROM "Application";

# Exit
\q
```

### Check Redis
```bash
# Connect to Redis
docker compose exec redis redis-cli

# View all keys
KEYS *

# Exit
exit
```

### Monitor Resources
```bash
# CPU and Memory usage
docker stats

# Disk usage
docker system df
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

### Database Connection Error
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# View PostgreSQL logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### Redis Connection Error
```bash
# Check if Redis is running
docker compose ps redis

# Restart Redis
docker compose restart redis
```

### Application Crashes
```bash
# Check logs for errors
docker compose logs --tail=50 api

# Restart application
docker compose restart api worker
```

### Clean Start (Reset Everything)
```bash
# WARNING: This will delete all data!
docker compose down -v
docker compose up --build -d
docker compose exec api npx prisma migrate deploy
```

## Backup Database

```bash
# Backup
docker compose exec postgres pg_dump -U postgres suretyseven > backup.sql

# Restore
docker compose exec -T postgres psql -U postgres suretyseven < backup.sql
```

## Production Checklist

- [ ] Environment variables configured in `.env`
- [ ] Firewall configured (UFW)
- [ ] Nginx reverse proxy setup
- [ ] SSL certificate installed
- [ ] Database backup scheduled
- [ ] Log rotation configured
- [ ] Monitoring setup (optional)
- [ ] Auto-restart on crash configured

## Access Your API

Once deployed, your API will be available at:

- **With Nginx**: `http://your-domain.com` or `http://your-ip-address`
- **Without Nginx**: `http://your-ip-address:3000`

## API Endpoints

- **Health Check**: `GET /health`
- **Readiness Check**: `GET /ready`
- **Create Application**: `POST /applications`
- **Get Application**: `GET /applications/:applicationId`

## Support

For detailed API documentation, see [README.md](README.md)
