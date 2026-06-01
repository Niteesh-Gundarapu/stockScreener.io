#!/bin/bash

# Stock Screener - NSE API Implementation Quick Start Script
# This script helps you set up and test the new NSE data API integration

set -e

echo "==========================================="
echo "Stock Screener - NSE API Quick Start"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check environment
echo -e "${BLUE}Step 1: Checking environment...${NC}"
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node -v)${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}Step 2: Installing backend dependencies...${NC}"
cd backend
if [ -d "node_modules" ]; then
    echo "✓ node_modules exists, skipping install"
else
    npm install
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Setup .env
echo -e "${BLUE}Step 3: Setting up environment variables...${NC}"
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit backend/.env and add your API keys:${NC}"
    echo "   - UPSTOX_API_KEY (optional, but recommended for better performance)"
    echo "   - RAPIDAPI_KEY (optional, for fallback)"
    echo ""
    echo "   To get Upstox key: https://upstox.com/api/"
    echo ""
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Step 4: Syntax validation
echo -e "${BLUE}Step 4: Validating code syntax...${NC}"
node -c index.js
node -c scraper.js
node -c services/nseDataService.js
echo -e "${GREEN}✓ All files have valid syntax${NC}"
echo ""

# Step 5: Ready to start
echo -e "${BLUE}Step 5: Starting backend server...${NC}"
echo -e "${YELLOW}Starting in 3 seconds...${NC}"
echo ""
sleep 3

echo -e "${GREEN}==========================================="
echo "🚀 Starting Stock Screener Backend"
echo "==========================================${NC}"
echo ""
echo "📋 Server will start at: http://localhost:5000"
echo ""
echo "📊 Available endpoints:"
echo "   • GET /api/market/gainers"
echo "   • GET /api/market/losers"
echo "   • GET /api/market/leaders"
echo ""
echo "📝 To test the API:"
echo "   curl http://localhost:5000/api/market/gainers"
echo ""
echo "⚡ Press Ctrl+C to stop the server"
echo ""

# Start the dev server
npm run dev
