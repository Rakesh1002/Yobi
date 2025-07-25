#!/bin/bash

# SearXNG Setup Script for Yobi Financial Platform
# This script sets up a self-hosted SearXNG instance optimized for financial data

set -e

echo "🚀 Setting up SearXNG for Financial Data Searching"
echo "=================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Generate secret key if not provided
if [ -z "$SEARXNG_SECRET_KEY" ]; then
    echo "📝 Generating SearXNG secret key..."
    export SEARXNG_SECRET_KEY=$(openssl rand -base64 32)
    echo "Generated secret key: $SEARXNG_SECRET_KEY"
    echo "💡 Save this key in your environment variables for production use."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p searxng/data
mkdir -p nginx/ssl

# Set permissions
echo "🔒 Setting permissions..."
chmod 755 searxng
chmod 755 searxng/data

# Replace secret key in settings.yml
echo "⚙️  Configuring settings..."
sed -i.bak "s/__SEARXNG_SECRET__/$SEARXNG_SECRET_KEY/g" searxng/settings.yml

# Create environment file
echo "📄 Creating environment file..."
cat > .env << EOF
SEARXNG_SECRET_KEY=$SEARXNG_SECRET_KEY
SEARXNG_URL=http://localhost:8080
EOF

# Start services
echo "🐳 Starting SearXNG services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🏥 Performing health check..."
if curl -f http://localhost:8080/stats > /dev/null 2>&1; then
    echo "✅ SearXNG is running successfully!"
    echo ""
    echo "🌐 Access SearXNG at: http://localhost:8080"
    echo "📊 View stats at: http://localhost:8080/stats"
    echo "🔧 Configuration: searxng/settings.yml"
    echo ""
    echo "🎯 Financial Search Engines Enabled:"
    echo "   - Google, Bing, DuckDuckGo, Yahoo"
    echo "   - Yahoo Finance, Google News"
    echo "   - Google Scholar for research"
    echo "   - Reddit for sentiment analysis"
    echo "   - Custom SEC.gov and Finviz engines"
    echo ""
    echo "📝 Environment Variables:"
    echo "   SEARXNG_URL=http://localhost:8080"
    echo "   SEARXNG_SECRET_KEY=$SEARXNG_SECRET_KEY"
    echo ""
    echo "🚀 Integration: Update your background-agent .env file:"
    echo "   echo 'SEARXNG_URL=http://localhost:8080' >> apps/trading-platform/background-agent/.env"
else
    echo "❌ SearXNG failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Test financial search
echo "🧪 Testing financial search functionality..."
if command -v curl &> /dev/null; then
    echo "Testing search for AAPL..."
    curl -s "http://localhost:8080/search?q=AAPL+earnings+financial&format=json" | head -5
    echo "✅ Financial search test completed"
fi

echo ""
echo "🎉 SearXNG setup complete!"
echo ""
echo "📚 Next Steps:"
echo "1. Configure your trading platform to use SEARXNG_URL=http://localhost:8080"
echo "2. Test the UnifiedSearchService in your background-agent"
echo "3. Monitor performance with docker-compose logs -f searxng"
echo "4. Scale up with multiple instances if needed"
echo ""
echo "🔧 Management Commands:"
echo "   docker-compose up -d      # Start services"
echo "   docker-compose down       # Stop services"
echo "   docker-compose logs -f    # View logs"
echo "   docker-compose restart    # Restart services" 