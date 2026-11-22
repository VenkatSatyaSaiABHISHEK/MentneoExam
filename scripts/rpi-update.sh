#!/bin/bash
# ==============================================================================
# ExamS Platform - 1-Command Remote Update for Raspberry Pi
# ==============================================================================
set -e

echo "Pulling latest changes from GitHub..."
git pull origin master

echo "Installing dependencies..."
npm install

echo "Building production bundles..."
npm run build

echo "Restarting ExamS server..."
pm2 restart exams

echo "Testing health check..."
sleep 2
curl -s http://localhost:3000/api/ping | grep -q "ok" && echo "ExamS updated and live at https://exam.inducodes.tech!" || echo "Check logs: pm2 logs exams"
