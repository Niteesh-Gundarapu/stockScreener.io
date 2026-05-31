#!/usr/bin/env bash
# Setup script for running migrations and starting the application

echo "🚀 Stock Trading Platform - Setup & Migration Script"
echo "=================================================="

# Navigate to backend
cd backend || exit

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found in backend/"
    echo "Please create .env with DATABASE_URL and other required variables"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🗄️  Running Prisma migrations..."
npm run prisma:migrate

echo "✅ Prisma client generated"
npm run prisma:generate

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start the server, run:"
echo "  npm start       # Production mode"
echo "  npm run dev     # Development with nodemon"
echo ""
echo "📊 Available API Endpoints:"
echo "  - POST   /api/auth/register             - Register new user"
echo "  - POST   /api/auth/login                - Login user"
echo "  - GET    /api/market-analysis/status    - Get market status (holiday aware)"
echo "  - GET    /api/market-analysis/summary   - Get market summary"
echo "  - GET    /api/market-analysis/winners   - Get top gainers"
echo "  - GET    /api/market-analysis/losers    - Get top losers"
echo "  - GET    /api/market-analysis/end-of-day - Get end-of-day report"
echo "  - GET    /api/market-analysis/momentum/:ticker - Get stock momentum"
echo "  - GET    /api/market-analysis/momentum-shift/:ticker - Analyze momentum shifts"
echo "  - GET    /api/market-analysis/market-status-with-data - Get categorized data (today/previous/next)"
