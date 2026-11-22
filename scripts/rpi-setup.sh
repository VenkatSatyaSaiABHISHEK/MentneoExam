#!/bin/bash
# ==============================================================================
# ExamS Platform - Raspberry Pi 4 (64-bit Linux) Automated Setup Script
# ==============================================================================
set -e

echo "============================================================"
echo "Installing ExamS on Raspberry Pi 4"
echo "============================================================"

# 1. System packages update
echo "[1/6] Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw

# 2. Install Node.js 20 LTS (ARM64)
echo "[2/6] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
node -v
npm -v

# 3. Install and configure PostgreSQL
echo "[3/6] Setting up PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create exams_db database and set postgres password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" || true
sudo -u postgres psql -c "CREATE DATABASE exams_db;" || true

# 4. Install PM2 for 24/7 service management
echo "[4/6] Installing PM2 Process Manager..."
sudo npm install -g pm2
pm2 startup systemd -u $USER --hp $HOME || true

# 5. Install Cloudflare Tunnel (cloudflared for ARM64)
echo "[5/6] Installing Cloudflare Tunnel..."
if ! command -v cloudflared &> /dev/null; then
  curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i cloudflared.deb
  rm -f cloudflared.deb
fi

# Configure Cloudflare Tunnel service with production token
TUNNEL_TOKEN="eyJhIjoiZWQzYTVjYmY4YjBmMGMwYTk4ZGFhY2E3OTg0MGQwZjkiLCJ0IjoiZjFmYjJkZmMtYmNhMS00ZjgzLWJmM2YtMTAxY2MyMjQ5ZTcwIiwicyI6IllUVXlNREl3WVdFdFl6a3lOeTAwTVdZNExXRTRaRGt0TmpJMk5URmlaVGRrWlRoaSJ9"
sudo cloudflared service install "$TUNNEL_TOKEN" || true
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared

# 6. Build and start application
echo "[6/6] Installing dependencies and building ExamS..."

# Generate production environment file if missing
if [ ! -f .env.local ]; then
  echo "Configuring .env.local..."
  cat << 'EOF' > .env.local
ADMIN_PIN=31012005
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/exams_db
NEXT_PUBLIC_APP_URL=https://exam.inducodes.tech
OCR_SERVICE_URL=http://localhost:8000
OCR_SERVICE_SECRET=change-this-to-a-secure-random-string
EOF
fi

npm install
npm run build

pm2 start ecosystem.config.cjs
pm2 save

echo "============================================================"
echo "ExamS is now running 24/7 on your Raspberry Pi!"
echo "Local URL  : http://localhost:3000"
echo "Public URL : https://exam.inducodes.tech"
echo "============================================================"
